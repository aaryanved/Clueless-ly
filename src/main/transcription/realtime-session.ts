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
}

/**
 * A single OpenAI Realtime transcription connection, dedicated to one speaker role
 * (mic = 'me', system audio = 'them'). Audio is expected as PCM16 mono @ 24kHz, the
 * format the Realtime API consumes; the renderer resamples before pushing.
 */
export class RealtimeTranscriptionSession {
  private ws: WebSocket | null = null
  private ready = false
  private pending: string[] = [] // base64 audio queued until the socket is open
  private closedByUs = false

  constructor(
    private readonly role: SpeakerRole,
    private readonly cb: SessionCallbacks
  ) {}

  async connect(): Promise<void> {
    const apiKey = assertApiKey()
    const model = getConfig().realtimeModel
    const url = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`

    this.ws = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    })

    this.ws.on('open', () => {
      this.ready = true
      // Configure the session for transcription only.
      this.sendJson({
        type: 'session.update',
        session: {
          input_audio_format: 'pcm16',
          input_audio_transcription: { model: getConfig().transcribeModel },
          turn_detection: { type: 'server_vad', silence_duration_ms: 500 }
        }
      })
      for (const chunk of this.pending) this.appendBase64(chunk)
      this.pending = []
      log.info('realtime session open', { role: this.role })
    })

    this.ws.on('message', (data) => this.handleMessage(data.toString()))
    this.ws.on('error', (err) => {
      log.warn('realtime socket error', { role: this.role, err })
      this.cb.onError(err instanceof Error ? err.message : String(err))
    })
    this.ws.on('close', (code) => {
      this.ready = false
      if (!this.closedByUs) log.warn('realtime socket closed', { role: this.role, code })
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
    // Defensive: the Realtime API has iterated on event names for transcription.
    if (type.endsWith('input_audio_transcription.delta')) {
      const itemId = String(msg['item_id'] ?? 'live')
      const delta = String(msg['delta'] ?? '')
      if (delta) this.cb.onSegment({ itemId, role: this.role, text: delta, isFinal: false })
    } else if (type.endsWith('input_audio_transcription.completed')) {
      const itemId = String(msg['item_id'] ?? 'live')
      const transcript = String(msg['transcript'] ?? '')
      this.cb.onSegment({ itemId, role: this.role, text: transcript, isFinal: true })
    } else if (type === 'error') {
      const errObj = msg['error'] as { message?: string } | undefined
      this.cb.onError(errObj?.message ?? 'Realtime API error')
    }
  }

  private sendJson(obj: unknown): void {
    if (this.ws && this.ready) this.ws.send(JSON.stringify(obj))
  }

  private appendBase64(b64: string): void {
    this.sendJson({ type: 'input_audio_buffer.append', audio: b64 })
  }

  /** Push a chunk of PCM16 audio. Queued if the socket is not open yet. */
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
