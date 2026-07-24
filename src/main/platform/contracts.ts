// Platform contracts. Shared application code depends ONLY on these interfaces.
// Concrete OS behaviour lives in ./base (cross-platform defaults) and, on the
// platform branches, in ./darwin and ./win32. This is what keeps the core free of
// `if (process.platform === 'darwin')` branching.

import type { BrowserWindow } from 'electron'
import type {
  Platform,
  PermissionKind,
  PermissionStatus,
  PlatformDescription
} from '@shared/types'

export interface PermissionAdapter {
  /** Query current status without prompting the user. */
  check(kind: PermissionKind): Promise<PermissionStatus>
  /** Trigger the OS permission prompt where the platform supports it. */
  request(kind: PermissionKind): Promise<PermissionStatus>
  /** Deep-link the user to the relevant OS settings pane. */
  openSettings(kind: PermissionKind): Promise<void>
}

export type SystemAudioMethod = 'screencapturekit' | 'wasapi-loopback' | 'none'

export interface AudioCapabilities {
  microphone: boolean
  systemAudio: boolean
  systemAudioMethod: SystemAudioMethod
  notes: string
}

export interface AudioAdapter {
  capabilities(): AudioCapabilities
  /**
   * The audio option the main process passes to setDisplayMediaRequestHandler
   * when the renderer asks for system audio. 'loopback' => WASAPI loopback (win),
   * 'include' => ScreenCaptureKit tab/system audio (mac), 'none' => unsupported.
   */
  systemAudioConstraint(): 'loopback' | 'include' | 'none'
}

export interface ScreenSource {
  id: string
  name: string
  displayId?: string
  thumbnailDataUrl?: string
}

export interface ScreenAdapter {
  listSources(): Promise<ScreenSource[]>
  /** Grab a single still frame as a PNG data URL, or null if capture is blocked. */
  captureFrame(sourceId?: string): Promise<{ dataUrl: string; width: number; height: number } | null>
  capabilities(): { screenshot: boolean; systemPicker: boolean }
}

export interface SecureStorageAdapter {
  isAvailable(): boolean
  /** e.g. 'keychain', 'dpapi', 'libsecret', 'plaintext-fallback'. */
  backend(): string
  set(key: string, value: string): Promise<void>
  get(key: string): Promise<string | null>
  delete(key: string): Promise<void>
}

export interface WindowAdapter {
  /** Apply the full overlay behaviour set (content protection, always-on-top, etc). */
  applyOverlayBehavior(win: BrowserWindow): void
  setContentProtection(win: BrowserWindow, enabled: boolean): void
  setClickThrough(win: BrowserWindow, enabled: boolean): void
  supportsContentProtection(): boolean
  contentProtectionNotes(): string
}

export interface GlobalShortcutAdapter {
  register(accelerator: string, handler: () => void): boolean
  unregisterAll(): void
  /** Platform-appropriate default accelerators, keyed by action id. */
  defaults(): Record<string, string>
}

export interface SystemInfoAdapter {
  readonly platform: Platform
  describe(): PlatformDescription
}

export interface PlatformAdapter {
  readonly id: Platform
  readonly displayName: string
  readonly permissions: PermissionAdapter
  readonly audio: AudioAdapter
  readonly screen: ScreenAdapter
  readonly secureStorage: SecureStorageAdapter
  readonly window: WindowAdapter
  readonly shortcuts: GlobalShortcutAdapter
  readonly system: SystemInfoAdapter
  init(): Promise<void>
  dispose(): Promise<void>
}
