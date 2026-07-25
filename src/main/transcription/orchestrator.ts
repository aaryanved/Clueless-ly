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
  // Accumulated partial text per item (the API sends incremental deltas).
  private partials = new Map<string, string>()
  // Recent system-audio ('them') text, used to drop microphone echo of the speakers.
  private recentThem: Array<{ norm: string; at: number }> = []

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
    this.partials.clear()
    this.recentThem = []
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
    // No banner: the header dot + soundwave already indicate listening.
    events.status({ transcribing: true })
    log.info('transcription started')
  }

  stop(): void {
    if (!this.active) return
    this.active = false
    for (const s of this.sessions.values()) s.close()
    this.sessions.clear()
    events.status({ transcribing: false })
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

  private normalize(t: string): string {
    // Keep latin + Devanagari (Hindi) word characters for comparison.
    return t
      .toLowerCase()
      .replace(/[^a-z0-9ऀ-ॿ ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private similar(a: string, b: string): boolean {
    if (!a || !b) return false
    if (a === b) return true
    if (a.length >= 6 && b.includes(a)) return true
    if (b.length >= 6 && a.includes(b)) return true
    const ta = new Set(a.split(' '))
    const tb = new Set(b.split(' '))
    let inter = 0
    for (const t of ta) if (tb.has(t)) inter++
    const overlap = inter / Math.max(ta.size, tb.size)
    return overlap >= 0.75 && Math.min(ta.size, tb.size) >= 3
  }

  /** Is this microphone text an echo of system audio we recently heard? */
  private isEchoOfThem(text: string): boolean {
    const now = Date.now()
    this.recentThem = this.recentThem.filter((r) => now - r.at < 8000)
    const norm = this.normalize(text)
    if (norm.length < 6) return false
    return this.recentThem.some((r) => this.similar(norm, r.norm))
  }

  private handleSegment(seg: RealtimeSegment): void {
    const id = `${seg.role}:${seg.itemId}`
    // Accumulate incremental deltas so partials show the full phrase, not one word.
    let text: string
    if (seg.isFinal) {
      text = seg.text
      this.partials.delete(id)
    } else {
      text = (this.partials.get(id) ?? '') + seg.text
      this.partials.set(id, text)
    }

    // Remember system audio so we can suppress its echo through the microphone.
    if (seg.role === 'them' && text.trim()) {
      this.recentThem.push({ norm: this.normalize(text), at: Date.now() })
      if (this.recentThem.length > 30) this.recentThem.shift()
    }
    // Drop microphone text that just repeats what the speakers were playing.
    if (seg.role === 'me' && this.isEchoOfThem(text)) {
      this.partials.delete(id)
      return
    }

    const segment: TranscriptSegment = { id, role: seg.role, text, isFinal: seg.isFinal, at: Date.now() }
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
