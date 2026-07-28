// Types shared between the main and renderer processes. Keep this file free of any
// Node/Electron/DOM imports so it can be consumed from both sides.

export type Platform = 'darwin' | 'win32' | 'linux' | 'base'

export type PermissionKind = 'microphone' | 'screen' | 'accessibility'

export type PermissionStatus =
  | 'granted'
  | 'denied'
  | 'restricted'
  | 'not-determined'
  | 'unknown'
  | 'unsupported'

export interface PlatformDescription {
  id: Platform
  displayName: string
  osVersion: string
  arch: string
  appVersion: string
  contentProtection: {
    supported: boolean
    notes: string
  }
  systemAudio: {
    supported: boolean
    method: 'screencapturekit' | 'wasapi-loopback' | 'none'
    notes: string
  }
}

export interface ConfigStatus {
  // We never expose the key itself - only whether it is present and well-formed.
  openaiKeyPresent: boolean
  openaiKeyLooksValid: boolean
  model: string
  transcriptionModel: string
  realtimeModel: string
  problems: string[]
}

export type SpeakerRole = 'me' | 'them' | 'system'

export interface TranscriptSegment {
  id: string
  role: SpeakerRole
  text: string
  isFinal: boolean
  at: number
}

export interface ScreenSnapshot {
  id: string
  capturedAt: number
  width: number
  height: number
  // A short model-generated description of what is on screen, plus OCR-ish text if any.
  summary: string
  ocrText?: string
}

export interface ContextSnapshot {
  transcript: TranscriptSegment[]
  screen?: ScreenSnapshot
  tokenEstimate: number
}

// Context material the user supplies. `user` is global (used for every answer);
// `interview` is used when interview mode is on; `speech` when speech mode is on.
export interface UserContext {
  text: string
  savedAt?: number
}
export interface InterviewContext {
  jobDescription: string
  resume: string
  projects: string
  savedAt?: number
}
export interface SpeechContext {
  text: string
  savedAt?: number
}
export interface ContextData {
  user: UserContext
  interview: InterviewContext
  speech: SpeechContext
}

export interface Note {
  id: string
  at: number
  text: string
  kind: 'user' | 'ai' | 'summary'
}

/** One completed question/answer exchange, stored so a session can be reopened. */
export interface SessionMessage {
  id: string
  question: string
  answer: string
  at: number
}

export interface Session {
  id: string
  title: string
  startedAt: number
  /** Last time anything was recorded into this session; drives sidebar ordering. */
  updatedAt: number
  endedAt?: number
  transcript: TranscriptSegment[]
  messages: SessionMessage[]
  notes: Note[]
  summary?: string
  /** Set once the user renames a session, so auto-titling stops touching it. */
  titleLocked?: boolean
}

export interface SessionSummary {
  id: string
  title: string
  startedAt: number
  updatedAt: number
  endedAt?: number
  noteCount: number
  segmentCount: number
  messageCount: number
}

export type ThemeMode = 'dark' | 'light'
export type WindowLayout = 'center' | 'left' | 'right'

// Assistant modes. They combine: coding + interview = technical interview.
export interface AppModes {
  coding: boolean
  interview: boolean
  chess: boolean
  speech: boolean
}

export interface AppSettings {
  model: string
  transcriptionModel: string
  realtimeModel: string
  captureScreenContext: boolean
  systemAudioEnabled: boolean
  microphoneEnabled: boolean
  contentProtectionEnabled: boolean
  clickThroughEnabled: boolean
  theme: ThemeMode
  windowLayout: WindowLayout
  overlayOpacity: number
  maxContextTokens: number
  modes: AppModes
  // When true, the microphone is off by default (only device/system audio is
  // transcribed) and the "talk" hotkey toggles the mic on so your own voice is
  // captured only when you intend it. This separates your input from device audio.
  pushToTalk: boolean
  shortcuts: Record<string, string>
}

export interface AiAskRequest {
  question: string
  useScreenContext: boolean
  useTranscriptContext: boolean
  sessionId?: string
}

export interface AppStatus {
  ready: boolean
  config: ConfigStatus
  platform: PlatformDescription
  activeSessionId?: string
  transcribing: boolean
}

// Events streamed from main -> renderer.
export interface TranscriptEvent {
  segment: TranscriptSegment
}
export interface AiQuestionEvent {
  requestId: string
  question: string
  // 'auto' when triggered by a question detected in the transcript.
  source: 'auto' | 'manual'
}
export interface AiTokenEvent {
  requestId: string
  token: string
}
export interface AiDoneEvent {
  requestId: string
  text: string
}
export interface StatusEvent {
  transcribing?: boolean
  message?: string
}
export interface ErrorEvent {
  scope: string
  message: string
}
export interface ShortcutEvent {
  action: string
}
export interface TalkEvent {
  active: boolean
}
/** Pushed whenever the saved-session list or the active session changes. */
export interface SessionsEvent {
  sessions: SessionSummary[]
  activeId?: string
}
