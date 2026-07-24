import type { BrowserWindow } from 'electron'
import { createLogger } from '../../logging'
import { BaseWindow } from '../base'

const log = createLogger('platform:darwin:window')

/**
 * macOS overlay behaviour. On top of the shared behaviour it:
 *  - keeps the window above full-screen apps (screen-saver level + 1),
 *  - hides it from Mission Control / window switching,
 *  - relies on setContentProtection, which maps to NSWindowSharingNone so the overlay
 *    is excluded from screen recording and most screen-sharing tools.
 */
export class DarwinWindow extends BaseWindow {
  override supportsContentProtection(): boolean {
    return true
  }

  override contentProtectionNotes(): string {
    return 'macOS: setContentProtection sets NSWindowSharingType to none, excluding the overlay from screen recording and ScreenCaptureKit-based sharing. Behaviour on very old macOS releases may vary.'
  }

  override applyOverlayBehavior(win: BrowserWindow): void {
    super.applyOverlayBehavior(win)
    try {
      // Sit above full-screen apps and the menu bar.
      win.setAlwaysOnTop(true, 'screen-saver', 1)
      // Keep the overlay out of Mission Control and app switching.
      const anyWin = win as unknown as {
        setHiddenInMissionControl?: (v: boolean) => void
        setWindowButtonVisibility?: (v: boolean) => void
      }
      anyWin.setHiddenInMissionControl?.(true)
      anyWin.setWindowButtonVisibility?.(false)
    } catch (err) {
      log.warn('failed to apply macOS overlay behaviour', { err })
    }
  }
}
