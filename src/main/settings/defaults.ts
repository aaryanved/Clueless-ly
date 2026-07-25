import type { AppSettings } from '@shared/types'
import { getConfig } from '../config'
import type { PlatformAdapter } from '../platform'

/** Computes initial settings from config + the resolved platform's capabilities. */
export function defaultSettings(platform: PlatformAdapter): AppSettings {
  const cfg = getConfig()
  const audio = platform.audio.capabilities()
  return {
    model: cfg.model,
    transcriptionModel: cfg.transcribeModel,
    realtimeModel: cfg.realtimeModel,
    captureScreenContext: true,
    systemAudioEnabled: audio.systemAudio,
    microphoneEnabled: true,
    contentProtectionEnabled: platform.window.supportsContentProtection(),
    clickThroughEnabled: true,
    theme: 'dark',
    windowLayout: 'center',
    overlayOpacity: 0.52,
    maxContextTokens: 2000,
    modes: { coding: false, interview: false, chess: false, speech: false },
    pushToTalk: true,
    shortcuts: { ...platform.shortcuts.defaults(), talk: 'CommandOrControl+Shift+M' }
  }
}
