import { randomUUID } from 'node:crypto'
import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc'
import type {
  Note,
  Session,
  SessionMessage,
  SessionSummary,
  TranscriptSegment
} from '@shared/types'
import { createLogger } from '../logging'
import { events } from '../events'
import { store } from '../storage/json-store'
import type { StorageAdapter } from '../storage/storage-adapter'
import { orchestrator } from '../transcription/orchestrator'
import { clearAskHistory, setAnswerSink, setAskHistory } from '../ai/ask-service'
import { complete } from '../ai/openai-client'
import { hasApiKey } from '../config'

const log = createLogger('sessions')
const INDEX_KEY = 'sessions'
const TITLE_MAX = 52
/** Transcript segments arrive continuously; don't push a list update for each one. */
const NOTIFY_INTERVAL_MS = 1000

interface SessionIndex {
  activeId?: string
  sessions: Record<string, Session>
}

/** First line of the opening question, trimmed to something that fits a sidebar row. */
function deriveTitle(question: string): string {
  const one = question.replace(/\s+/g, ' ').trim()
  if (!one) return 'New chat'
  return one.length > TITLE_MAX ? `${one.slice(0, TITLE_MAX).trimEnd()}…` : one
}

/**
 * Owns session lifecycle and local persistence: conversations, transcripts, notes and
 * summaries, all written to a JSON file under userData. Live transcript segments and
 * finished AI answers are folded into the active session automatically, so the sidebar
 * history builds itself without the user having to save anything.
 *
 * Sessions are created lazily: a session only appears once it has real content, which
 * keeps "New chat" from littering the list with empty rows.
 */
export class SessionManager {
  private data: SessionIndex = { sessions: {} }
  private loaded = false
  private lastNotify = 0
  private notifyTimer: NodeJS.Timeout | null = null
  private writeChain: Promise<void> = Promise.resolve()

  constructor(private readonly storage: StorageAdapter = store) {}

  async init(): Promise<void> {
    if (this.loaded) return
    const saved = await this.storage.readJson<SessionIndex>(INDEX_KEY)
    // Whatever was active in the previous run is history now: the app always opens on a
    // fresh conversation, with the saved ones reachable from the sidebar.
    if (saved) this.data = { sessions: saved.sessions ?? {} }
    // Sessions written by older builds predate `messages` / `updatedAt`.
    for (const s of Object.values(this.data.sessions)) {
      if (!Array.isArray(s.messages)) s.messages = []
      if (!Array.isArray(s.notes)) s.notes = []
      if (!Array.isArray(s.transcript)) s.transcript = []
      if (typeof s.updatedAt !== 'number') s.updatedAt = s.endedAt ?? s.startedAt
    }
    this.loaded = true

    // Capture finalised transcript segments into the active session as they arrive.
    orchestrator.onSegment((seg) => {
      if (seg.isFinal && seg.text.trim()) void this.recordSegment(seg)
    })
    // Persist completed AI answers as structured messages on the active/target session.
    setAnswerSink((req, question, answer) => {
      void this.recordMessage(question, answer, req.sessionId)
    })
    log.info('session manager ready', { count: Object.keys(this.data.sessions).length })
  }

  /**
   * Serialize writes. Answers and transcript segments can land in the same tick, and the
   * JSON store writes through a shared per-process temp file, so overlapping writes would
   * race on the rename.
   */
  private async persist(): Promise<void> {
    this.writeChain = this.writeChain
      .catch(() => {})
      .then(() => this.storage.writeJson(INDEX_KEY, this.data))
    return this.writeChain
  }

  /** Push the list + active id to the renderer, coalescing bursts of segment writes. */
  private notify(immediate = false): void {
    if (this.notifyTimer) {
      clearTimeout(this.notifyTimer)
      this.notifyTimer = null
    }
    const since = Date.now() - this.lastNotify
    if (!immediate && since < NOTIFY_INTERVAL_MS) {
      this.notifyTimer = setTimeout(() => this.notify(true), NOTIFY_INTERVAL_MS - since)
      return
    }
    this.lastNotify = Date.now()
    events.sessions({ sessions: this.list(), activeId: this.data.activeId })
  }

  private touch(session: Session): void {
    session.updatedAt = Date.now()
  }

  activeId(): string | undefined {
    return this.data.activeId
  }

  list(): SessionSummary[] {
    return Object.values(this.data.sessions)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((s) => ({
        id: s.id,
        title: s.title,
        startedAt: s.startedAt,
        updatedAt: s.updatedAt,
        endedAt: s.endedAt,
        noteCount: s.notes.length,
        segmentCount: s.transcript.length,
        messageCount: s.messages.length
      }))
  }

  get(id: string): Session | null {
    return this.data.sessions[id] ?? null
  }

  async create(title?: string): Promise<Session> {
    const now = Date.now()
    const session: Session = {
      id: randomUUID(),
      title: title?.trim() || 'New chat',
      startedAt: now,
      updatedAt: now,
      transcript: [],
      messages: [],
      notes: [],
      titleLocked: !!title?.trim()
    }
    this.data.sessions[session.id] = session
    this.data.activeId = session.id
    await this.persist()
    this.notify(true)
    return session
  }

  /** The session content should land in, created on demand. */
  private async ensureActive(): Promise<Session> {
    const existing = this.data.activeId ? this.data.sessions[this.data.activeId] : undefined
    if (existing) return existing
    const now = Date.now()
    const session: Session = {
      id: randomUUID(),
      title: 'New chat',
      startedAt: now,
      updatedAt: now,
      transcript: [],
      messages: [],
      notes: []
    }
    this.data.sessions[session.id] = session
    this.data.activeId = session.id
    return session
  }

  /**
   * Reopen a saved session: make it active and restore the AI's short-term memory and
   * transcript buffer so the conversation continues rather than restarting cold.
   */
  async activate(id: string): Promise<Session | null> {
    const session = this.data.sessions[id]
    if (!session) return null
    this.data.activeId = id
    session.endedAt = undefined
    setAskHistory(session.messages.map((m) => ({ question: m.question, answer: m.answer })))
    orchestrator.setTranscript(session.transcript)
    await this.persist()
    this.notify(true)
    log.info('session activated', { id, messages: session.messages.length })
    return session
  }

  /**
   * Close out the current conversation. A session that never gathered content is
   * discarded rather than saved, so the history stays meaningful.
   */
  async startNewConversation(): Promise<void> {
    const id = this.data.activeId
    if (id) {
      const session = this.data.sessions[id]
      if (session && !session.messages.length && !session.transcript.length) {
        delete this.data.sessions[id]
      } else if (session) {
        session.endedAt = Date.now()
      }
    }
    this.data.activeId = undefined
    await this.persist()
    this.notify(true)
  }

  async rename(id: string, title: string): Promise<void> {
    const session = this.data.sessions[id]
    if (!session) return
    const clean = title.replace(/\s+/g, ' ').trim()
    if (!clean) return
    session.title = clean.slice(0, 120)
    session.titleLocked = true
    await this.persist()
    this.notify(true)
  }

  async remove(id: string): Promise<void> {
    if (!this.data.sessions[id]) return
    delete this.data.sessions[id]
    if (this.data.activeId === id) {
      // Deleting what you were just talking in should also drop it from the AI's
      // short-term memory and the transcript buffer, not just the list.
      this.data.activeId = undefined
      clearAskHistory()
      orchestrator.clearTranscript()
    }
    await this.persist()
    this.notify(true)
  }

  async appendNote(id: string, note: Omit<Note, 'id' | 'at'>): Promise<Note> {
    const session = this.data.sessions[id]
    if (!session) throw new Error(`Unknown session: ${id}`)
    const full: Note = { id: randomUUID(), at: Date.now(), ...note }
    session.notes.push(full)
    this.touch(session)
    await this.persist()
    this.notify()
    return full
  }

  /** Record a finished exchange, auto-titling the session from its first question. */
  private async recordMessage(
    question: string,
    answer: string,
    sessionId?: string
  ): Promise<void> {
    // A renderer-supplied id wins, but fall back to the active session if it is stale
    // (e.g. the conversation was reset while the answer was still streaming).
    const session = (sessionId && this.data.sessions[sessionId]) || (await this.ensureActive())
    const message: SessionMessage = { id: randomUUID(), question, answer, at: Date.now() }
    session.messages.push(message)
    if (!session.titleLocked && session.messages.length === 1) {
      session.title = deriveTitle(question)
    }
    this.touch(session)
    await this.persist()
    this.notify(true)
  }

  private async recordSegment(seg: TranscriptSegment): Promise<void> {
    const session = await this.ensureActive()
    const idx = session.transcript.findIndex((s) => s.id === seg.id)
    if (idx >= 0) session.transcript[idx] = seg
    else session.transcript.push(seg)
    // A listen-only session (meeting, interview) never gets a question to name it, so
    // give it a provisional title from what was said first. The first asked question,
    // if one comes, replaces this in recordMessage().
    if (!session.titleLocked && !session.messages.length && session.title === 'New chat') {
      session.title = deriveTitle(seg.text)
    }
    this.touch(session)
    await this.persist()
    this.notify()
  }

  async end(id: string): Promise<void> {
    const session = this.data.sessions[id]
    if (!session) return
    session.endedAt = Date.now()
    if (this.data.activeId === id) this.data.activeId = undefined
    await this.persist()
    this.notify(true)
  }

  async summarize(id: string): Promise<string> {
    const session = this.data.sessions[id]
    if (!session) throw new Error(`Unknown session: ${id}`)
    if (!hasApiKey()) {
      throw new Error('Cannot summarize: OpenAI API key is not configured.')
    }
    const transcript = session.transcript.map((s) => `${s.role}: ${s.text}`).join('\n')
    const exchanges = session.messages.map((m) => `Q: ${m.question}\nA: ${m.answer}`).join('\n')
    const notes = session.notes.map((n) => `[${n.kind}] ${n.text}`).join('\n')
    const summary = await complete([
      {
        role: 'system',
        content:
          'Summarize this session into concise bullet points: key topics, decisions, ' +
          'questions asked, and any action items. Keep it under 200 words.'
      },
      {
        role: 'user',
        content: `Transcript:\n${transcript}\n\nExchanges:\n${exchanges}\n\nNotes:\n${notes}`
      }
    ])
    session.summary = summary
    session.notes.push({ id: randomUUID(), at: Date.now(), kind: 'summary', text: summary })
    this.touch(session)
    await this.persist()
    this.notify(true)
    return summary
  }
}

export const sessionManager = new SessionManager()

export function registerSessionsIpc(): void {
  ipcMain.handle(IpcChannels.SessionsList, async () => sessionManager.list())
  ipcMain.handle(IpcChannels.SessionCreate, async (_e, title?: string) =>
    sessionManager.create(title)
  )
  ipcMain.handle(IpcChannels.SessionGet, async (_e, id: string) => sessionManager.get(id))
  ipcMain.handle(IpcChannels.SessionActivate, async (_e, id: string) =>
    sessionManager.activate(id)
  )
  ipcMain.handle(IpcChannels.SessionRename, async (_e, id: string, title: string) =>
    sessionManager.rename(id, title)
  )
  ipcMain.handle(IpcChannels.SessionDelete, async (_e, id: string) => sessionManager.remove(id))
  ipcMain.handle(
    IpcChannels.SessionAppendNote,
    async (_e, id: string, note: Omit<Note, 'id' | 'at'>) => sessionManager.appendNote(id, note)
  )
  ipcMain.handle(IpcChannels.SessionEnd, async (_e, id: string) => sessionManager.end(id))
  ipcMain.handle(IpcChannels.SessionSummarize, async (_e, id: string) =>
    sessionManager.summarize(id)
  )
}
