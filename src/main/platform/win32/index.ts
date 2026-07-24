import { createLogger } from '../../logging'
import type { PlatformAdapter } from '../contracts'
import type { Platform } from '@shared/types'
import { BaseAudio, BaseScreen, BaseSecureStorage, BaseShortcuts } from '../base'
import { Win32Permissions } from './permissions'
import { Win32Window } from './window'
import { Win32SystemInfo } from './system-info'

const log = createLogger('platform:win32')

/**
 * The Windows platform adapter. Screen capture, secure storage (DPAPI via Electron
 * safeStorage) and global shortcuts use the cross-platform base implementations. This
 * batch wires up permissions, overlay window behaviour and system info; system audio
 * (WASAPI loopback) is added in the next batch, so BaseAudio (system audio disabled)
 * is used for now.
 */
export class Win32PlatformAdapter implements PlatformAdapter {
  readonly id: Platform = 'win32'
  readonly displayName = 'Windows'
  readonly permissions = new Win32Permissions()
  readonly audio = new BaseAudio()
  readonly screen = new BaseScreen()
  readonly secureStorage = new BaseSecureStorage() // Electron safeStorage => DPAPI
  readonly window = new Win32Window()
  readonly shortcuts = new BaseShortcuts()
  readonly system = new Win32SystemInfo()

  async init(): Promise<void> {
    log.info('Windows platform adapter initialised', {
      secureBackend: this.secureStorage.backend(),
      version: process.getSystemVersion?.()
    })
  }

  async dispose(): Promise<void> {
    this.shortcuts.unregisterAll()
  }
}

export function createAdapter(): PlatformAdapter {
  return new Win32PlatformAdapter()
}
