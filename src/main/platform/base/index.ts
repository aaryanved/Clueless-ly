// Cross-platform base adapter. Uses Electron APIs that work on every desktop OS.
// The darwin/win32 branches subclass or replace individual pieces where the OS
// needs specific handling (system-audio method, permission prompts, notarisation).

import os from 'node:os'
import {
  app,
  desktopCapturer,
  globalShortcut,
  screen,
  systemPreferences,
  shell,
  BrowserWindow
} from 'electron'
import { createLogger } from '../../logging'
import type {
  AudioAdapter,
  AudioCapabilities,
  GlobalShortcutAdapter,
  PermissionAdapter,
  PlatformAdapter,
  ScreenAdapter,
  ScreenSource,
  SystemInfoAdapter,
  WindowAdapter
} from '../contracts'
import type { Platform, PermissionKind, PermissionStatus, PlatformDescription } from '@shared/types'
import { BaseSecureStorage } from './secure-storage'
export { BaseSecureStorage } from './secure-storage'

const log = createLogger('platform:base')

export class BasePermissions implements PermissionAdapter {
  async check(kind: PermissionKind): Promise<PermissionStatus> {
    // getMediaAccessStatus is implemented on macOS and Windows for microphone/screen.
    try {
      if (kind === 'microphone' || kind === 'screen') {
        const media = kind === 'screen' ? 'screen' : 'microphone'
        const status = systemPreferences.getMediaAccessStatus(media as 'microphone' | 'screen')
        return (status as PermissionStatus) ?? 'unknown'
      }
    } catch (err) {
      log.debug('permission check unsupported', { kind, err })
    }
    return 'unsupported'
  }

  async request(kind: PermissionKind): Promise<PermissionStatus> {
    // Base platform can only prompt for the microphone (macOS); other prompts are
    // OS-specific and handled in the platform branches.
    try {
      if (kind === 'microphone' && typeof systemPreferences.askForMediaAccess === 'function') {
        const granted = await systemPreferences.askForMediaAccess('microphone')
        return granted ? 'granted' : 'denied'
      }
    } catch (err) {
      log.debug('permission request unsupported', { kind, err })
    }
    return this.check(kind)
  }

  async openSettings(_kind: PermissionKind): Promise<void> {
    // No universal deep-link; platform branches override with the correct URI.
    await shell.openExternal('https://')
  }
}

export class BaseAudio implements AudioAdapter {
  capabilities(): AudioCapabilities {
    return {
      microphone: true,
      systemAudio: false,
      systemAudioMethod: 'none',
      notes:
        'Base build does not enable system-audio capture. Use the platform build ' +
        '(mac: ScreenCaptureKit, windows: WASAPI loopback).'
    }
  }

  systemAudioConstraint(): 'loopback' | 'include' | 'none' {
    return 'none'
  }
}

export class BaseScreen implements ScreenAdapter {
  capabilities() {
    return { screenshot: true, systemPicker: false }
  }

  async listSources(): Promise<ScreenSource[]> {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 180 }
    })
    return sources.map((s) => ({
      id: s.id,
      name: s.name,
      displayId: s.display_id || undefined,
      thumbnailDataUrl: s.thumbnail?.toDataURL()
    }))
  }

  async captureFrame(sourceId?: string) {
    const primary = screen.getPrimaryDisplay()
    const { width, height } = primary.size
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width, height }
    })
    const chosen = sourceId ? sources.find((s) => s.id === sourceId) : sources[0]
    if (!chosen || chosen.thumbnail.isEmpty()) return null
    const size = chosen.thumbnail.getSize()
    return { dataUrl: chosen.thumbnail.toDataURL(), width: size.width, height: size.height }
  }
}

export class BaseWindow implements WindowAdapter {
  supportsContentProtection(): boolean {
    // setContentProtection is a documented Electron API on both macOS and Windows.
    return process.platform === 'darwin' || process.platform === 'win32'
  }

  contentProtectionNotes(): string {
    return 'Overlay privacy uses Electron setContentProtection (NSWindow sharingType on macOS, WDA_EXCLUDEFROMCAPTURE on Windows 10 2004+).'
  }

  applyOverlayBehavior(win: BrowserWindow): void {
    win.setAlwaysOnTop(true, 'screen-saver')
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    win.setSkipTaskbar(true)
    this.setContentProtection(win, true)
  }

  setContentProtection(win: BrowserWindow, enabled: boolean): void {
    try {
      win.setContentProtection(enabled)
    } catch (err) {
      log.warn('setContentProtection failed', { err })
    }
  }

  setClickThrough(win: BrowserWindow, enabled: boolean): void {
    win.setIgnoreMouseEvents(enabled, { forward: true })
  }
}

export class BaseShortcuts implements GlobalShortcutAdapter {
  register(accelerator: string, handler: () => void): boolean {
    try {
      return globalShortcut.register(accelerator, handler)
    } catch (err) {
      log.warn('shortcut register failed', { accelerator, err })
      return false
    }
  }

  unregisterAll(): void {
    globalShortcut.unregisterAll()
  }

  defaults(): Record<string, string> {
    return {
      toggleOverlay: 'CommandOrControl+Shift+Space',
      askQuestion: 'CommandOrControl+Shift+Enter',
      toggleClickThrough: 'CommandOrControl+Shift+X',
      captureScreen: 'CommandOrControl+Shift+S'
    }
  }
}

export class BaseSystemInfo implements SystemInfoAdapter {
  readonly platform: Platform = (process.platform as Platform) ?? 'base'

  describe(): PlatformDescription {
    return {
      id: 'base',
      displayName: 'Cross-platform (base)',
      osVersion: process.getSystemVersion?.() ?? os.release(),
      arch: process.arch,
      appVersion: app.getVersion(),
      contentProtection: {
        supported: new BaseWindow().supportsContentProtection(),
        notes: new BaseWindow().contentProtectionNotes()
      },
      systemAudio: {
        supported: false,
        method: 'none',
        notes: 'System audio requires a platform build.'
      }
    }
  }
}

export class BasePlatformAdapter implements PlatformAdapter {
  readonly id: Platform = 'base'
  readonly displayName = 'Cross-platform (base)'
  readonly permissions = new BasePermissions()
  readonly audio = new BaseAudio()
  readonly screen = new BaseScreen()
  readonly secureStorage = new BaseSecureStorage()
  readonly window = new BaseWindow()
  readonly shortcuts = new BaseShortcuts()
  readonly system = new BaseSystemInfo()

  async init(): Promise<void> {
    log.info('base platform adapter initialised', { platform: process.platform })
  }

  async dispose(): Promise<void> {
    this.shortcuts.unregisterAll()
  }
}

export function createBaseAdapter(): PlatformAdapter {
  return new BasePlatformAdapter()
}
