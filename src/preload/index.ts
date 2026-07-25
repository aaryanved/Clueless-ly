import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels } from '../shared/ipc'
import type {
  AiAskRequest,
  AppSettings,
  AppStatus,
  ConfigStatus,
  ContextSnapshot,
  Note,
  PermissionKind,
  PermissionStatus,
  PlatformDescription,
  ScreenSnapshot,
  Session,
  SessionSummary
} from '../shared/types'

// The single object exposed to the renderer. contextIsolation is on, so this is the
// only bridge between the sandboxed UI and the privileged main process.
const api = {
  getStatus: (): Promise<AppStatus> => ipcRenderer.invoke(IpcChannels.AppGetStatus),
  quit: (): Promise<void> => ipcRenderer.invoke(IpcChannels.AppQuit),
  toggleTalk: (): Promise<boolean> => ipcRenderer.invoke(IpcChannels.TalkToggle),

  config: {
    get: (): Promise<ConfigStatus> => ipcRenderer.invoke(IpcChannels.ConfigGet),
    validate: (): Promise<ConfigStatus> => ipcRenderer.invoke(IpcChannels.ConfigValidate)
  },

  ai: {
    ask: (req: AiAskRequest): Promise<{ requestId: string }> =>
      ipcRenderer.invoke(IpcChannels.AiAsk, req)
  },

  transcription: {
    start: (): Promise<void> => ipcRenderer.invoke(IpcChannels.TranscriptionStart),
    stop: (): Promise<void> => ipcRenderer.invoke(IpcChannels.TranscriptionStop),
    pushAudio: (role: 'me' | 'them', pcm: ArrayBuffer): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.TranscriptionPushAudio, role, pcm)
  },

  context: {
    captureScreen: (): Promise<ScreenSnapshot | null> =>
      ipcRenderer.invoke(IpcChannels.ContextCaptureScreen),
    getSnapshot: (): Promise<ContextSnapshot> => ipcRenderer.invoke(IpcChannels.ContextGetSnapshot),
    setDocument: (text: string): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.ContextSetDocument, text),
    getDocument: (): Promise<string> => ipcRenderer.invoke(IpcChannels.ContextGetDocument),
    parseFile: (name: string, bytes: ArrayBuffer): Promise<string> =>
      ipcRenderer.invoke(IpcChannels.ContextParseFile, name, bytes)
  },

  sessions: {
    list: (): Promise<SessionSummary[]> => ipcRenderer.invoke(IpcChannels.SessionsList),
    create: (title?: string): Promise<Session> =>
      ipcRenderer.invoke(IpcChannels.SessionCreate, title),
    newConversation: (): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.SessionNewConversation),
    get: (id: string): Promise<Session | null> => ipcRenderer.invoke(IpcChannels.SessionGet, id),
    appendNote: (id: string, note: Omit<Note, 'id' | 'at'>): Promise<Note> =>
      ipcRenderer.invoke(IpcChannels.SessionAppendNote, id, note),
    end: (id: string): Promise<void> => ipcRenderer.invoke(IpcChannels.SessionEnd, id),
    summarize: (id: string): Promise<string> => ipcRenderer.invoke(IpcChannels.SessionSummarize, id)
  },

  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke(IpcChannels.SettingsGet),
    set: (patch: Partial<AppSettings>): Promise<AppSettings> =>
      ipcRenderer.invoke(IpcChannels.SettingsSet, patch)
  },

  platform: {
    info: (): Promise<PlatformDescription> => ipcRenderer.invoke(IpcChannels.PlatformInfo),
    permissionCheck: (kind: PermissionKind): Promise<PermissionStatus> =>
      ipcRenderer.invoke(IpcChannels.PlatformPermissionCheck, kind),
    permissionRequest: (kind: PermissionKind): Promise<PermissionStatus> =>
      ipcRenderer.invoke(IpcChannels.PlatformPermissionRequest, kind),
    openPermissionSettings: (kind: PermissionKind): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.PlatformOpenPermissionSettings, kind)
  },

  overlay: {
    setClickThrough: (enabled: boolean): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.OverlayToggleClickThrough, enabled),
    setInteractive: (enabled: boolean): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.OverlaySetInteractive, enabled),
    setMinimized: (minimized: boolean): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.OverlaySetMinimized, minimized),
    setContentProtection: (enabled: boolean): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.OverlaySetContentProtection, enabled),
    hide: (): Promise<void> => ipcRenderer.invoke(IpcChannels.OverlayHide),
    show: (): Promise<void> => ipcRenderer.invoke(IpcChannels.OverlayShow)
  },

  // Event subscriptions (main -> renderer). Each returns an unsubscribe function.
  on: {
    transcript: (cb: (payload: unknown) => void) => subscribe(IpcChannels.EvtTranscript, cb),
    aiQuestion: (cb: (payload: unknown) => void) => subscribe(IpcChannels.EvtAiQuestion, cb),
    aiToken: (cb: (payload: unknown) => void) => subscribe(IpcChannels.EvtAiToken, cb),
    aiDone: (cb: (payload: unknown) => void) => subscribe(IpcChannels.EvtAiDone, cb),
    status: (cb: (payload: unknown) => void) => subscribe(IpcChannels.EvtStatus, cb),
    error: (cb: (payload: unknown) => void) => subscribe(IpcChannels.EvtError, cb),
    shortcut: (cb: (payload: unknown) => void) => subscribe(IpcChannels.EvtShortcut, cb),
    talk: (cb: (payload: unknown) => void) => subscribe(IpcChannels.EvtTalk, cb)
  }
}

function subscribe(channel: string, cb: (payload: unknown) => void): () => void {
  const listener = (_e: unknown, payload: unknown) => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

contextBridge.exposeInMainWorld('clueless', api)

export type CluelessApi = typeof api
