import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc'
import type { SpeakerRole, TranscriptSegment } from '@shared/types'
import { createLogger } from '../logging'
import { events } from '../events'
import { hasApiKey } from '../config'
import { RealtimeTranscriptionSession, type RealtimeSegment } from './realtime-session'

const log = createLogger('transcription')

/**
 * Owns the live transcription lifecycle. It lazily opens one Realtime session per
 * speaker role and keeps a rolling in-memory transcript that the context engine and
 * session manager read from. Emits transcript segments to the renderer as they land.
 */
export class TranscriptionOrchestrator {
  private sessions = new Map<SpeakerRole, RealtimeTranscriptionSession>()
  private active = false
  private segments: TranscriptSegment[] = []
  private onSegmentHooks: Array<(seg: TranscriptSegment) => void> = []

  isActive(): boolean {
    return this.active
  }

  /** Snapshot of recent transcript for context building / session capture. */
  recent(limit = 100): TranscriptSegment[] {
    return this.segments.slice(-limit)
  }

  /** Drop the in-memory transcript buffer (used when starting a new conversation). */
  clearTranscript(): void {
    this.segments = []
  }

  onSegment(hook: (seg: TranscriptSegment) => void): void {
    this.onSegmentHooks.push(hook)
  }

  start(): void {
    if (this.active) return
    if (!hasApiKey()) {
      events.error({
        scope: 'transcription',
        message: 'Cannot start transcription: OpenAI API key is not configured.'
      })
      return
    }
    this.active = true
    events.status({ transcribing: true, message: 'Listening…' })
    log.info('transcription started')
  }

  stop(): void {
    if (!this.active) return
    this.active = false
    for (const s of this.sessions.values()) s.close()
    this.sessions.clear()
    events.status({ transcribing: false, message: 'Stopped listening.' })
    log.info('transcription stopped')
  }

  private ensureSession(role: SpeakerRole): RealtimeTranscriptionSession {
    let session = this.sessions.get(role)
    if (!session) {
      session = new RealtimeTranscriptionSession(role, {
        onSegment: (seg) => this.handleSegment(seg),
        onError: (message) => events.error({ scope: 'transcription', message }),
        onClose: () => {
          // Drop the closed session so the next audio chunk re-opens a fresh one
          // while we are still listening (handles transient disconnects).
          if (this.sessions.get(role) === session) this.sessions.delete(role)
        }
      })
      this.sessions.set(role, session)
      void session.connect()
    }
    return session
  }

  private handleSegment(seg: RealtimeSegment): void {
    const id = `${seg.role}:${seg.itemId}`
    const segment: TranscriptSegment = {
      id,
      role: seg.role,
      text: seg.text,
      isFinal: seg.isFinal,
      at: Date.now()
    }
    // Partial deltas replace the live item; finals are kept in history.
    const idx = this.segments.findIndex((s) => s.id === id)
    if (idx >= 0) this.segments[idx] = segment
    else this.segments.push(segment)
    if (this.segments.length > 500) this.segments = this.segments.slice(-500)

    events.transcript({ segment })
    for (const hook of this.onSegmentHooks) hook(segment)
  }

  pushAudio(role: SpeakerRole, pcm: Buffer): void {
    if (!this.active) return
    this.ensureSession(role).pushAudio(pcm)
  }
}

export const orchestrator = new TranscriptionOrchestrator()

export function registerTranscriptionIpc(): void {
  ipcMain.handle(IpcChannels.TranscriptionStart, async () => orchestrator.start())
  ipcMain.handle(IpcChannels.TranscriptionStop, async () => orchestrator.stop())
  ipcMain.handle(
    IpcChannels.TranscriptionPushAudio,
    async (_e, role: SpeakerRole, pcm: ArrayBuffer) => {
      orchestrator.pushAudio(role, Buffer.from(pcm))
    }
  )
}
