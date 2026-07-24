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
  // We never expose the key itself — only whether it is present and well-formed.
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

export interface Note {
  id: string
  at: number
  text: string
  kind: 'user' | 'ai' | 'summary'
}

export interface Session {
  id: string
  title: string
  startedAt: number
  endedAt?: number
  transcript: TranscriptSegment[]
  notes: Note[]
  summary?: string
}

export interface SessionSummary {
  id: string
  title: string
  startedAt: number
  endedAt?: number
  noteCount: number
  segmentCount: number
}

export interface AppSettings {
  model: string
  transcriptionModel: string
  realtimeModel: string
  captureScreenContext: boolean
  systemAudioEnabled: boolean
  microphoneEnabled: boolean
  contentProtectionEnabled: boolean
  overlayOpacity: number
  maxContextTokens: number
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
