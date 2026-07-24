import type { BrowserWindow } from 'electron'
import { createLogger } from '../../logging'
import { BaseWindow } from '../base'

const log = createLogger('platform:win32:window')

/**
 * Windows overlay behaviour. Content protection maps to SetWindowDisplayAffinity with
 * WDA_EXCLUDEFROMCAPTURE (Windows 10 version 2004 / build 19041 and newer), which keeps
 * the overlay out of screen captures and most screen-sharing tools while remaining
 * visible on the user's own display. Skipping the taskbar also removes it from Alt+Tab.
 */
export class Win32Window extends BaseWindow {
  override supportsContentProtection(): boolean {
    return true
  }

  override contentProtectionNotes(): string {
    return 'Windows: setContentProtection uses SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE), available on Windows 10 2004+ (build 19041). On older builds the overlay may still be captured.'
  }

  override applyOverlayBehavior(win: BrowserWindow): void {
    super.applyOverlayBehavior(win)
    try {
      win.setAlwaysOnTop(true, 'screen-saver')
      win.setSkipTaskbar(true)
    } catch (err) {
      log.warn('failed to apply Windows overlay behaviour', { err })
    }
  }
}
