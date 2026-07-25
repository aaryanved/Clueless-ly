// Central registry of IPC channel names. Keeping these as string constants in one
// place avoids typo-driven "channel has no handler" bugs across the process boundary.

export const IpcChannels = {
  // Renderer -> Main (invoke/handle)
  AppGetStatus: 'app:get-status',
  AppQuit: 'app:quit',
  TalkToggle: 'talk:toggle',
  ConfigGet: 'config:get',
  ConfigValidate: 'config:validate',

  AiComplete: 'ai:complete',
  AiAsk: 'ai:ask',

  TranscriptionStart: 'transcription:start',
  TranscriptionStop: 'transcription:stop',
  TranscriptionPushAudio: 'transcription:push-audio',

  ContextCaptureScreen: 'context:capture-screen',
  ContextGetSnapshot: 'context:get-snapshot',
  ContextGetAll: 'context:get-all',
  ContextSetUser: 'context:set-user',
  ContextClearUser: 'context:clear-user',
  ContextSetInterview: 'context:set-interview',
  ContextClearInterview: 'context:clear-interview',
  ContextSetSpeech: 'context:set-speech',
  ContextClearSpeech: 'context:clear-speech',
  ContextParseFile: 'context:parse-file',

  SessionsList: 'sessions:list',
  SessionCreate: 'sessions:create',
  SessionNewConversation: 'sessions:new-conversation',
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
  OverlaySetInteractive: 'overlay:set-interactive',
  OverlaySetMinimized: 'overlay:set-minimized',
  OverlaySetLayout: 'overlay:set-layout',
  OverlaySetContentProtection: 'overlay:set-content-protection',
  OverlayHide: 'overlay:hide',
  OverlayShow: 'overlay:show',

  // Main -> Renderer (send/on)
  EvtTranscript: 'evt:transcript',
  EvtAiQuestion: 'evt:ai-question',
  EvtAiToken: 'evt:ai-token',
  EvtAiDone: 'evt:ai-done',
  EvtStatus: 'evt:status',
  EvtError: 'evt:error',
  EvtShortcut: 'evt:shortcut',
  EvtTalk: 'evt:talk'
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]
