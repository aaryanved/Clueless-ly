import { randomUUID } from 'node:crypto'
import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc'
import type { Note, Session, SessionSummary, TranscriptSegment } from '@shared/types'
import { createLogger } from '../logging'
import { store } from '../storage/json-store'
import type { StorageAdapter } from '../storage/storage-adapter'
import { orchestrator } from '../transcription/orchestrator'
import { setAnswerSink } from '../ai/ask-service'
import { complete } from '../ai/openai-client'
import { hasApiKey } from '../config'

const log = createLogger('sessions')
const INDEX_KEY = 'sessions'

interface SessionIndex {
  activeId?: string
  sessions: Record<string, Session>
}

/**
 * Owns session lifecycle and persistence: conversations, notes, and summaries. Live
 * transcript segments and AI answers are folded into the active session automatically.
 */
export class SessionManager {
  private data: SessionIndex = { sessions: {} }
  private loaded = false

  constructor(private readonly storage: StorageAdapter = store) {}

  async init(): Promise<void> {
    if (this.loaded) return
    const saved = await this.storage.readJson<SessionIndex>(INDEX_KEY)
    if (saved) this.data = saved
    this.loaded = true

    // Capture finalised transcript segments into the active session as they arrive.
    orchestrator.onSegment((seg) => {
      if (seg.isFinal) void this.recordSegment(seg)
    })
    // Persist completed AI answers as notes on the active/target session.
    setAnswerSink((req, question, answer) => {
      const id = req.sessionId ?? this.data.activeId
      if (id) void this.appendNote(id, { kind: 'ai', text: `Q: ${question}\nA: ${answer}` })
    })
    log.info('session manager ready', { count: Object.keys(this.data.sessions).length })
  }

  private async persist(): Promise<void> {
    await this.storage.writeJson(INDEX_KEY, this.data)
  }

  activeId(): string | undefined {
    return this.data.activeId
  }

  list(): SessionSummary[] {
    return Object.values(this.data.sessions)
      .sort((a, b) => b.startedAt - a.startedAt)
      .map((s) => ({
        id: s.id,
        title: s.title,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        noteCount: s.notes.length,
        segmentCount: s.transcript.length
      }))
  }

  get(id: string): Session | null {
    return this.data.sessions[id] ?? null
  }

  async create(title?: string): Promise<Session> {
    const session: Session = {
      id: randomUUID(),
      title: title?.trim() || `Session ${new Date().toLocaleString()}`,
      startedAt: Date.now(),
      transcript: [],
      notes: []
    }
    this.data.sessions[session.id] = session
    this.data.activeId = session.id
    await this.persist()
    return session
  }

  async appendNote(id: string, note: Omit<Note, 'id' | 'at'>): Promise<Note> {
    const session = this.data.sessions[id]
    if (!session) throw new Error(`Unknown session: ${id}`)
    const full: Note = { id: randomUUID(), at: Date.now(), ...note }
    session.notes.push(full)
    await this.persist()
    return full
  }

  private async recordSegment(seg: TranscriptSegment): Promise<void> {
    const id = this.data.activeId
    if (!id) return
    const session = this.data.sessions[id]
    if (!session) return
    const idx = session.transcript.findIndex((s) => s.id === seg.id)
    if (idx >= 0) session.transcript[idx] = seg
    else session.transcript.push(seg)
    await this.persist()
  }

  async end(id: string): Promise<void> {
    const session = this.data.sessions[id]
    if (!session) return
    session.endedAt = Date.now()
    if (this.data.activeId === id) this.data.activeId = undefined
    await this.persist()
  }

  async summarize(id: string): Promise<string> {
    const session = this.data.sessions[id]
    if (!session) throw new Error(`Unknown session: ${id}`)
    if (!hasApiKey()) {
      throw new Error('Cannot summarize: OpenAI API key is not configured.')
    }
    const transcript = session.transcript.map((s) => `${s.role}: ${s.text}`).join('\n')
    const notes = session.notes.map((n) => `[${n.kind}] ${n.text}`).join('\n')
    const summary = await complete([
      {
        role: 'system',
        content:
          'Summarize this session into concise bullet points: key topics, decisions, ' +
          'questions asked, and any action items. Keep it under 200 words.'
      },
      { role: 'user', content: `Transcript:\n${transcript}\n\nNotes:\n${notes}` }
    ])
    session.summary = summary
    session.notes.push({ id: randomUUID(), at: Date.now(), kind: 'summary', text: summary })
    await this.persist()
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
  ipcMain.handle(
    IpcChannels.SessionAppendNote,
    async (_e, id: string, note: Omit<Note, 'id' | 'at'>) => sessionManager.appendNote(id, note)
  )
  ipcMain.handle(IpcChannels.SessionEnd, async (_e, id: string) => sessionManager.end(id))
  ipcMain.handle(IpcChannels.SessionSummarize, async (_e, id: string) =>
    sessionManager.summarize(id)
  )
}
