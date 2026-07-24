import { shell, systemPreferences } from 'electron'
import { createLogger } from '../../logging'
import type { PermissionAdapter } from '../contracts'
import type { PermissionKind, PermissionStatus } from '@shared/types'

const log = createLogger('platform:darwin:permissions')

// Deep links into the macOS System Settings > Privacy & Security panes.
const SETTINGS_URI: Record<PermissionKind, string> = {
  microphone: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
  screen: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
  accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
}

export class DarwinPermissions implements PermissionAdapter {
  async check(kind: PermissionKind): Promise<PermissionStatus> {
    if (kind === 'microphone') {
      return systemPreferences.getMediaAccessStatus('microphone') as PermissionStatus
    }
    if (kind === 'screen') {
      // TCC-backed; 'granted' | 'denied' | 'restricted' | 'not-determined'.
      return systemPreferences.getMediaAccessStatus('screen') as PermissionStatus
    }
    if (kind === 'accessibility') {
      return systemPreferences.isTrustedAccessibilityClient(false) ? 'granted' : 'denied'
    }
    return 'unsupported'
  }

  async request(kind: PermissionKind): Promise<PermissionStatus> {
    if (kind === 'microphone') {
      const granted = await systemPreferences.askForMediaAccess('microphone')
      return granted ? 'granted' : 'denied'
    }
    if (kind === 'accessibility') {
      // Passing true prompts the user and opens the pane.
      const trusted = systemPreferences.isTrustedAccessibilityClient(true)
      return trusted ? 'granted' : 'denied'
    }
    if (kind === 'screen') {
      // macOS has no programmatic prompt for Screen Recording; the prompt appears the
      // first time capture is attempted. Guide the user to the settings pane.
      await this.openSettings('screen')
      return this.check('screen')
    }
    return 'unsupported'
  }

  async openSettings(kind: PermissionKind): Promise<void> {
    try {
      await shell.openExternal(SETTINGS_URI[kind])
    } catch (err) {
      log.warn('failed to open settings pane', { kind, err })
    }
  }
}
