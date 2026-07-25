import type { AudioAdapter, AudioCapabilities } from '../contracts'

/**
 * Windows audio capabilities. System audio is captured via WASAPI loopback, exposed to
 * Chromium through getDisplayMedia and granted by the main process with
 * `audio: 'loopback'` in the display-media request handler. This captures the audio the
 * machine is actually rendering (the "them" side of a call) - it is NOT a microphone
 * loopback. The renderer watches for output-device changes and re-acquires the stream
 * so switching to headphones / Bluetooth / USB devices keeps transcription running.
 */
export class Win32Audio implements AudioAdapter {
  capabilities(): AudioCapabilities {
    return {
      microphone: true,
      systemAudio: true,
      systemAudioMethod: 'wasapi-loopback',
      notes:
        'System audio uses WASAPI loopback on the current default render device. ' +
        'Handles default-device switches, headphones, Bluetooth and USB devices via ' +
        'stream re-acquisition. Requires Windows 10 or newer.'
    }
  }

  systemAudioConstraint(): 'loopback' | 'include' | 'none' {
    return 'loopback'
  }
}
