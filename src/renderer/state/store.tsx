import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode
} from 'react'
import type {
  AiDoneEvent,
  AiQuestionEvent,
  AiTokenEvent,
  AppSettings,
  AppStatus,
  ErrorEvent,
  Session,
  SessionsEvent,
  SessionSummary,
  ShortcutEvent,
  StatusEvent,
  TalkEvent,
  TranscriptEvent,
  TranscriptSegment
} from '@shared/types'

export type TabId = 'assistant' | 'transcript' | 'sessions' | 'settings'

export interface AiMessage {
  id: string
  question: string
  answer: string
  streaming: boolean
  at: number
}

export interface UiState {
  tab: TabId
  status: AppStatus | null
  settings: AppSettings | null
  transcript: TranscriptSegment[]
  messages: AiMessage[]
  sessions: SessionSummary[]
  // The saved session new content is being folded into. Null until the current
  // conversation has produced something worth keeping.
  activeSessionId: string | null
  sidebarOpen: boolean
  transcribing: boolean
  // Push-to-talk mic state (toggled by the talk hotkey).
  talkActive: boolean
  banner: { kind: 'error' | 'info'; text: string } | null
  // Text to drop into the ask box (e.g. from clicking a transcript line). The bump
  // counter makes repeated identical prefills still register in the input effect.
  prefill: { text: string; bump: number }
}

// The sidebar is a pure UI preference, so it lives in the renderer rather than settings.
const SIDEBAR_KEY = 'clueless.sidebarOpen'
function readSidebarPref(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_KEY) === '1'
  } catch {
    return false
  }
}

const initialState: UiState = {
  tab: 'assistant',
  status: null,
  settings: null,
  transcript: [],
  messages: [],
  sessions: [],
  activeSessionId: null,
  sidebarOpen: readSidebarPref(),
  transcribing: false,
  talkActive: false,
  banner: null,
  prefill: { text: '', bump: 0 }
}

type Action =
  | { type: 'setTab'; tab: TabId }
  | { type: 'setStatus'; status: AppStatus }
  | { type: 'setSettings'; settings: AppSettings }
  | { type: 'setSessions'; sessions: SessionSummary[]; activeId?: string }
  | { type: 'loadSession'; session: Session }
  | { type: 'toggleSidebar'; open?: boolean }
  | { type: 'upsertSegment'; segment: TranscriptSegment }
  | { type: 'clearTranscript' }
  | { type: 'clearMessages' }
  | { type: 'startMessage'; id: string; question: string }
  | { type: 'appendToken'; id: string; token: string }
  | { type: 'finishMessage'; id: string; text: string }
  | { type: 'setTranscribing'; value: boolean }
  | { type: 'setTalkActive'; value: boolean }
  | { type: 'banner'; banner: UiState['banner'] }
  | { type: 'prefillAsk'; text: string }

function reducer(state: UiState, action: Action): UiState {
  switch (action.type) {
    case 'setTab':
      return { ...state, tab: action.tab }
    case 'setStatus':
      return { ...state, status: action.status, transcribing: action.status.transcribing }
    case 'setSettings':
      return { ...state, settings: action.settings }
    case 'setSessions':
      return {
        ...state,
        sessions: action.sessions,
        activeSessionId: action.activeId ?? null
      }
    case 'loadSession':
      return {
        ...state,
        activeSessionId: action.session.id,
        transcript: action.session.transcript.slice(-200),
        messages: action.session.messages.map((m) => ({
          id: m.id,
          question: m.question,
          answer: m.answer,
          streaming: false,
          at: m.at
        }))
      }
    case 'toggleSidebar': {
      const open = action.open ?? !state.sidebarOpen
      try {
        window.localStorage.setItem(SIDEBAR_KEY, open ? '1' : '0')
      } catch {
        /* private mode / storage disabled: the preference just won't persist */
      }
      return { ...state, sidebarOpen: open }
    }
    case 'upsertSegment': {
      const idx = state.transcript.findIndex((s) => s.id === action.segment.id)
      const next = state.transcript.slice()
      if (idx >= 0) next[idx] = action.segment
      else next.push(action.segment)
      return { ...state, transcript: next.slice(-200) }
    }
    case 'clearTranscript':
      return { ...state, transcript: [] }
    case 'clearMessages':
      return { ...state, messages: [] }
    case 'startMessage':
      return {
        ...state,
        messages: [
          ...state.messages,
          { id: action.id, question: action.question, answer: '', streaming: true, at: Date.now() }
        ]
      }
    case 'appendToken':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.id ? { ...m, answer: m.answer + action.token } : m
        )
      }
    case 'finishMessage':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.id ? { ...m, answer: action.text || m.answer, streaming: false } : m
        )
      }
    case 'setTranscribing':
      return { ...state, transcribing: action.value }
    case 'setTalkActive':
      return { ...state, talkActive: action.value }
    case 'banner':
      return { ...state, banner: action.banner }
    case 'prefillAsk':
      return { ...state, prefill: { text: action.text, bump: state.prefill.bump + 1 } }
    default:
      return state
  }
}

interface StoreValue {
  state: UiState
  dispatch: React.Dispatch<Action>
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, dispatch] = useReducer(reducer, initialState)
  const dispatchRef = useRef(dispatch)
  dispatchRef.current = dispatch

  // Wire main -> renderer event streams into the store exactly once.
  useEffect(() => {
    const d = dispatchRef.current
    const unsubs = [
      window.clueless.on.transcript((p) => d({ type: 'upsertSegment', segment: (p as TranscriptEvent).segment })),
      window.clueless.on.aiQuestion((p) => {
        const e = p as AiQuestionEvent
        d({ type: 'startMessage', id: e.requestId, question: e.question })
      }),
      window.clueless.on.aiToken((p) => {
        const e = p as AiTokenEvent
        d({ type: 'appendToken', id: e.requestId, token: e.token })
      }),
      window.clueless.on.aiDone((p) => {
        const e = p as AiDoneEvent
        d({ type: 'finishMessage', id: e.requestId, text: e.text })
      }),
      window.clueless.on.status((p) => {
        const e = p as StatusEvent
        if (typeof e.transcribing === 'boolean') d({ type: 'setTranscribing', value: e.transcribing })
        if (e.message) d({ type: 'banner', banner: { kind: 'info', text: e.message } })
      }),
      window.clueless.on.error((p) => {
        const e = p as ErrorEvent
        d({ type: 'banner', banner: { kind: 'error', text: `${e.scope}: ${e.message}` } })
      }),
      window.clueless.on.shortcut((p) => {
        const e = p as ShortcutEvent
        if (e.action === 'askQuestion') d({ type: 'setTab', tab: 'assistant' })
      }),
      window.clueless.on.talk((p) => {
        d({ type: 'setTalkActive', value: (p as TalkEvent).active })
      }),
      // Main pushes the history whenever it changes, so the sidebar stays live as
      // titles are derived and transcript/answers are folded in.
      window.clueless.on.sessions((p) => {
        const e = p as SessionsEvent
        d({ type: 'setSessions', sessions: e.sessions, activeId: e.activeId })
      })
    ]

    // Initial data load. Handlers that don't exist yet simply surface as a banner.
    void window.clueless.getStatus().then((s) => d({ type: 'setStatus', status: s })).catch(() => {})
    void window.clueless.settings.get().then((s) => d({ type: 'setSettings', settings: s })).catch(() => {})
    void window.clueless.sessions.list().then((s) => d({ type: 'setSessions', sessions: s })).catch(() => {})

    return () => unsubs.forEach((u) => u())
  }, [])

  const value = useMemo(() => ({ state, dispatch }), [state])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
