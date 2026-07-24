import { desktopCapturer, session } from 'electron'
import { createLogger } from './logging'
import type { PlatformAdapter } from './platform'

const log = createLogger('capture-grant')

/**
 * Installs the display-media request handler. When the renderer calls
 * getDisplayMedia() to capture system audio, this handler fulfils it with a screen
 * source plus the platform's system-audio option:
 *   - macOS: `audio: 'loopback'` => ScreenCaptureKit system audio (macOS 13+)
 *   - Windows: `audio: 'loopback'` => WASAPI loopback
 * The overlay window is content-protected, so it is excluded from what gets captured.
 */
export function setupDisplayMediaHandler(platform: PlatformAdapter): void {
  const constraint = platform.audio.systemAudioConstraint()

  session.defaultSession.setDisplayMediaRequestHandler(
    (_request, callback) => {
      desktopCapturer
        .getSources({ types: ['screen'] })
        .then((sources) => {
          const video = sources[0]
          if (!video) {
            callback({})
            return
          }
          if (constraint === 'loopback') {
            callback({ video, audio: 'loopback' })
          } else {
            callback({ video })
          }
        })
        .catch((err) => {
          log.warn('display-media source lookup failed', { err })
          callback({})
        })
    },
    // We resolve the source ourselves rather than showing the OS picker, so the flow
    // stays silent and the overlay does not appear in a picker list.
    { useSystemPicker: false }
  )
  log.info('display-media handler installed', { audio: constraint })
}
