import WebSocket from 'ws'
import { assertApiKey, getConfig } from '../config'
import { createLogger } from '../logging'
import type { SpeakerRole } from '@shared/types'

const log = createLogger('realtime')

export interface RealtimeSegment {
  itemId: string
  role: SpeakerRole
  text: string
  isFinal: boolean
}

interface SessionCallbacks {
  onSegment: (seg: RealtimeSegment) => void
  onError: (message: string) => void
  onClose?: () => void
}

/**
 * A single OpenAI Realtime *transcription* connection, dedicated to one speaker role
 * (mic = 'me', system audio = 'them'). Uses the GA Realtime API transcription intent
 * (`?intent=transcription`) - the older Beta shape (with the `OpenAI-Beta: realtime=v1`
 * header) was retired by the server and closed the socket with code 4000. In the GA
 * shape all audio config is nested under `session.audio.input`. Audio is PCM16 mono
 * @ 24 kHz.
 */
export class RealtimeTranscriptionSession {
  private ws: WebSocket | null = null
  private ready = false
  private pending: string[] = [] // base64 audio queued until the socket is configured
  private closedByUs = false

  constructor(
    private readonly role: SpeakerRole,
    private readonly cb: SessionCallbacks
  ) {}

  async connect(): Promise<void> {
    const apiKey = assertApiKey()
    // GA Realtime API: no OpenAI-Beta header; transcription intent, no model in the URL.
    const url = 'wss://api.openai.com/v1/realtime?intent=transcription'

    this.ws = new WebSocket(url, {
      headers: { Authorization: `Bearer ${apiKey}` }
    })

    this.ws.on('open', () => {
      // Configure the transcription session before sending any audio (GA shape).
      this.sendJson({
        type: 'session.update',
        session: {
          type: 'transcription',
          audio: {
            input: {
              format: { type: 'audio/pcm', rate: 24000 },
              transcription: { model: getConfig().transcribeModel },
              turn_detection: {
                type: 'server_vad',
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 500
              }
            }
          }
        }
      })
      this.ready = true
      for (const chunk of this.pending) this.appendBase64(chunk)
      this.pending = []
      log.info('realtime transcription session open', { role: this.role })
    })

    this.ws.on('message', (data) => this.handleMessage(data.toString()))
    this.ws.on('error', (err) => {
      log.warn('realtime socket error', { role: this.role, err })
      this.cb.onError(err instanceof Error ? err.message : String(err))
    })
    this.ws.on('close', (code, reason) => {
      this.ready = false
      if (!this.closedByUs) {
        log.warn('realtime socket closed', { role: this.role, code, reason: reason?.toString() })
        this.cb.onClose?.()
      }
    })
  }

  private handleMessage(raw: string): void {
    let msg: Record<string, unknown>
    try {
      msg = JSON.parse(raw)
    } catch {
      return
    }
    const type = String(msg['type'] ?? '')
    // Defensive across API iterations of the transcription event names.
    if (type.endsWith('input_audio_transcription.delta')) {
      const itemId = String(msg['item_id'] ?? 'live')
      const delta = String(msg['delta'] ?? '')
      if (delta) this.cb.onSegment({ itemId, role: this.role, text: delta, isFinal: false })
    } else if (type.endsWith('input_audio_transcription.completed')) {
      const itemId = String(msg['item_id'] ?? 'live')
      const transcript = String(msg['transcript'] ?? '')
      if (transcript) this.cb.onSegment({ itemId, role: this.role, text: transcript, isFinal: true })
    } else if (type === 'error') {
      const errObj = msg['error'] as { message?: string } | undefined
      this.cb.onError(errObj?.message ?? 'Realtime API error')
    }
  }

  private sendJson(obj: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj))
  }

  private appendBase64(b64: string): void {
    this.sendJson({ type: 'input_audio_buffer.append', audio: b64 })
  }

  /** Push a chunk of PCM16 audio. Queued if the socket is not configured yet. */
  pushAudio(pcm: Buffer): void {
    const b64 = pcm.toString('base64')
    if (this.ready) this.appendBase64(b64)
    else this.pending.push(b64)
  }

  close(): void {
    this.closedByUs = true
    this.ready = false
    try {
      this.ws?.close()
    } catch {
      /* ignore */
    }
    this.ws = null
  }
}
