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
  AiTokenEvent,
  AppSettings,
  AppStatus,
  ErrorEvent,
  SessionSummary,
  ShortcutEvent,
  StatusEvent,
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
  transcribing: boolean
  banner: { kind: 'error' | 'info'; text: string } | null
}

const initialState: UiState = {
  tab: 'assistant',
  status: null,
  settings: null,
  transcript: [],
  messages: [],
  sessions: [],
  transcribing: false,
  banner: null
}

type Action =
  | { type: 'setTab'; tab: TabId }
  | { type: 'setStatus'; status: AppStatus }
  | { type: 'setSettings'; settings: AppSettings }
  | { type: 'setSessions'; sessions: SessionSummary[] }
  | { type: 'upsertSegment'; segment: TranscriptSegment }
  | { type: 'clearTranscript' }
  | { type: 'startMessage'; id: string; question: string }
  | { type: 'appendToken'; id: string; token: string }
  | { type: 'finishMessage'; id: string; text: string }
  | { type: 'setTranscribing'; value: boolean }
  | { type: 'banner'; banner: UiState['banner'] }

function reducer(state: UiState, action: Action): UiState {
  switch (action.type) {
    case 'setTab':
      return { ...state, tab: action.tab }
    case 'setStatus':
      return { ...state, status: action.status, transcribing: action.status.transcribing }
    case 'setSettings':
      return { ...state, settings: action.settings }
    case 'setSessions':
      return { ...state, sessions: action.sessions }
    case 'upsertSegment': {
      const idx = state.transcript.findIndex((s) => s.id === action.segment.id)
      const next = state.transcript.slice()
      if (idx >= 0) next[idx] = action.segment
      else next.push(action.segment)
      return { ...state, transcript: next.slice(-200) }
    }
    case 'clearTranscript':
      return { ...state, transcript: [] }
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
    case 'banner':
      return { ...state, banner: action.banner }
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
