import { shell, systemPreferences } from 'electron'
import { createLogger } from '../../logging'
import type { PermissionAdapter } from '../contracts'
import type { PermissionKind, PermissionStatus } from '@shared/types'

const log = createLogger('platform:win32:permissions')

// Windows privacy settings deep links (ms-settings: URIs).
const SETTINGS_URI: Record<PermissionKind, string> = {
  microphone: 'ms-settings:privacy-microphone',
  screen: 'ms-settings:privacy-broadfilesystemaccess',
  accessibility: 'ms-settings:easeofaccess'
}

/**
 * Windows permission model. Microphone access is gated by the Windows privacy setting
 * and reported via getMediaAccessStatus. Windows has no per-app "screen recording"
 * permission - screen and system-audio (WASAPI loopback) capture are allowed without a
 * separate grant - so screen reports 'granted'.
 */
export class Win32Permissions implements PermissionAdapter {
  async check(kind: PermissionKind): Promise<PermissionStatus> {
    if (kind === 'microphone') {
      try {
        return systemPreferences.getMediaAccessStatus('microphone') as PermissionStatus
      } catch {
        return 'unknown'
      }
    }
    if (kind === 'screen') return 'granted' // no OS gate on Windows
    return 'unsupported'
  }

  async request(kind: PermissionKind): Promise<PermissionStatus> {
    // Windows has no programmatic media-access prompt (that's macOS-only). The prompt
    // appears when capture is first attempted; if microphone is blocked at the OS
    // level, guide the user to the privacy pane.
    if (kind === 'microphone') {
      const status = await this.check('microphone')
      if (status !== 'granted') await this.openSettings('microphone')
      return status
    }
    return this.check(kind)
  }

  async openSettings(kind: PermissionKind): Promise<void> {
    try {
      await shell.openExternal(SETTINGS_URI[kind])
    } catch (err) {
      log.warn('failed to open settings', { kind, err })
    }
  }
}
