import { app } from 'electron'
import { createLogger } from '../../logging'
import type { PlatformAdapter } from '../contracts'
import type { Platform } from '@shared/types'
import { BaseScreen, BaseSecureStorage, BaseShortcuts } from '../base'
import { DarwinPermissions } from './permissions'
import { DarwinWindow } from './window'
import { DarwinAudio } from './audio'
import { DarwinSystemInfo } from './system-info'

const log = createLogger('platform:darwin')

/**
 * The complete macOS platform adapter. Screen capture, secure storage (Keychain) and
 * global shortcuts already work cross-platform via the base implementations, so this
 * adapter only replaces the pieces that need genuine macOS-specific behaviour:
 * permissions (TCC), overlay window behaviour, audio capabilities and system info.
 */
export class DarwinPlatformAdapter implements PlatformAdapter {
  readonly id: Platform = 'darwin'
  readonly displayName = 'macOS'
  readonly permissions = new DarwinPermissions()
  readonly audio = new DarwinAudio()
  readonly screen = new BaseScreen()
  readonly secureStorage = new BaseSecureStorage() // Electron safeStorage => Keychain
  readonly window = new DarwinWindow()
  readonly shortcuts = new BaseShortcuts()
  readonly system = new DarwinSystemInfo()

  async init(): Promise<void> {
    // Run as an accessory app: no Dock icon and not in Cmd+Tab, so the assistant stays
    // discreet. The tray/menu-bar item remains the way to show/hide and quit.
    try {
      app.setActivationPolicy('accessory')
      app.dock?.hide()
    } catch (err) {
      log.warn('failed to set accessory activation policy', { err })
    }
    log.info('macOS platform adapter initialised', {
      secureBackend: this.secureStorage.backend(),
      version: process.getSystemVersion?.()
    })
  }

  async dispose(): Promise<void> {
    this.shortcuts.unregisterAll()
  }
}

export function createAdapter(): PlatformAdapter {
  return new DarwinPlatformAdapter()
}
