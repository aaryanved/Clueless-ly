// Central registry of IPC channel names. Keeping these as string constants in one
// place avoids typo-driven "channel has no handler" bugs across the process boundary.

export const IpcChannels = {
  // Renderer -> Main (invoke/handle)
  AppGetStatus: 'app:get-status',
  ConfigGet: 'config:get',
  ConfigValidate: 'config:validate',

  AiComplete: 'ai:complete',
  AiAsk: 'ai:ask',

  TranscriptionStart: 'transcription:start',
  TranscriptionStop: 'transcription:stop',
  TranscriptionPushAudio: 'transcription:push-audio',

  ContextCaptureScreen: 'context:capture-screen',
  ContextGetSnapshot: 'context:get-snapshot',

  SessionsList: 'sessions:list',
  SessionCreate: 'sessions:create',
  SessionGet: 'sessions:get',
  SessionAppendNote: 'sessions:append-note',
  SessionEnd: 'sessions:end',
  SessionSummarize: 'sessions:summarize',

  SettingsGet: 'settings:get',
  SettingsSet: 'settings:set',

  PlatformInfo: 'platform:info',
  PlatformPermissionCheck: 'platform:permission-check',
  PlatformPermissionRequest: 'platform:permission-request',
  PlatformOpenPermissionSettings: 'platform:open-permission-settings',
  PlatformAudioSources: 'platform:audio-sources',

  OverlayToggleClickThrough: 'overlay:toggle-click-through',
  OverlaySetContentProtection: 'overlay:set-content-protection',
  OverlayHide: 'overlay:hide',
  OverlayShow: 'overlay:show',

  // Main -> Renderer (send/on)
  EvtTranscript: 'evt:transcript',
  EvtAiToken: 'evt:ai-token',
  EvtAiDone: 'evt:ai-done',
  EvtStatus: 'evt:status',
  EvtError: 'evt:error',
  EvtShortcut: 'evt:shortcut'
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]
