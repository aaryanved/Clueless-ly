import type { AudioAdapter, AudioCapabilities } from '../contracts'

/**
 * macOS audio capabilities. System audio is captured via ScreenCaptureKit, surfaced
 * to Chromium through getDisplayMedia; the main process grants it in the display-media
 * request handler with `audio: 'loopback'`. Requires macOS 13 (Ventura) or newer.
 */
export class DarwinAudio implements AudioAdapter {
  capabilities(): AudioCapabilities {
    return {
      microphone: true,
      systemAudio: true,
      systemAudioMethod: 'screencapturekit',
      notes:
        'System audio uses ScreenCaptureKit (macOS 13+). Requires Screen Recording ' +
        'permission. Not a microphone loopback - the actual rendered system audio is captured.'
    }
  }

  systemAudioConstraint(): 'loopback' | 'include' | 'none' {
    return 'loopback'
  }
}
