import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc'
import type { AppSettings } from '@shared/types'
import { createLogger } from '../logging'
import { store } from '../storage/json-store'
import type { StorageAdapter } from '../storage/storage-adapter'

const log = createLogger('settings')
const KEY = 'settings'

export type SettingsListener = (next: AppSettings, patch: Partial<AppSettings>) => void

/**
 * Persisted user settings. Defaults are computed once from config + platform
 * capabilities; saved overrides are merged on top. Listeners apply side effects
 * (content protection, shortcut re-registration, context token budget, …).
 */
export class SettingsService {
  private current: AppSettings | null = null
  private listeners: SettingsListener[] = []

  constructor(private readonly storage: StorageAdapter = store) {}

  async init(defaults: AppSettings): Promise<void> {
    const saved = await this.storage.readJson<Partial<AppSettings>>(KEY)
    this.current = {
      ...defaults,
      ...(saved ?? {}),
      modes: { ...defaults.modes, ...(saved?.modes ?? {}) },
      shortcuts: { ...defaults.shortcuts, ...(saved?.shortcuts ?? {}) }
    }
    log.info('settings loaded')
  }

  onChange(listener: SettingsListener): void {
    this.listeners.push(listener)
  }

  get(): AppSettings {
    if (!this.current) throw new Error('SettingsService not initialised')
    return this.current
  }

  async set(patch: Partial<AppSettings>): Promise<AppSettings> {
    const next: AppSettings = {
      ...this.get(),
      ...patch,
      modes: { ...this.get().modes, ...(patch.modes ?? {}) },
      shortcuts: { ...this.get().shortcuts, ...(patch.shortcuts ?? {}) }
    }
    this.current = next
    await this.storage.writeJson(KEY, next)
    for (const l of this.listeners) {
      try {
        l(next, patch)
      } catch (err) {
        log.warn('settings listener failed', { err })
      }
    }
    return next
  }
}

export const settingsService = new SettingsService()

export function registerSettingsIpc(): void {
  ipcMain.handle(IpcChannels.SettingsGet, async () => settingsService.get())
  ipcMain.handle(IpcChannels.SettingsSet, async (_e, patch: Partial<AppSettings>) =>
    settingsService.set(patch)
  )
}
