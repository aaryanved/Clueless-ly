import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { app, safeStorage } from 'electron'
import { createLogger } from '../../logging'
import type { SecureStorageAdapter } from '../contracts'

const log = createLogger('secure-storage')

/**
 * Cross-platform secure storage built on Electron's safeStorage, which uses the
 * OS-native credential facility under the hood: Keychain on macOS, DPAPI on
 * Windows, and libsecret where available on Linux. We persist the *encrypted*
 * blobs to a small JSON file in userData; the encryption keys never leave the OS.
 *
 * If OS-level encryption is unavailable we DO NOT silently store plaintext secrets;
 * callers can detect this via isAvailable()/backend() and warn the user instead.
 */
export class BaseSecureStorage implements SecureStorageAdapter {
  private file = join(app.getPath('userData'), 'secure-store.json')
  private cache: Record<string, string> | null = null

  isAvailable(): boolean {
    try {
      return safeStorage.isEncryptionAvailable()
    } catch {
      return false
    }
  }

  backend(): string {
    if (!this.isAvailable()) return 'unavailable'
    // getSelectedStorageBackend only exists on Linux; elsewhere it is OS-native.
    try {
      const anySafe = safeStorage as unknown as { getSelectedStorageBackend?: () => string }
      if (process.platform === 'linux' && anySafe.getSelectedStorageBackend) {
        return anySafe.getSelectedStorageBackend()
      }
    } catch {
      /* ignore */
    }
    return process.platform === 'darwin' ? 'keychain' : process.platform === 'win32' ? 'dpapi' : 'os-native'
  }

  private async load(): Promise<Record<string, string>> {
    if (this.cache) return this.cache
    try {
      const raw = await fs.readFile(this.file, 'utf8')
      this.cache = JSON.parse(raw) as Record<string, string>
    } catch {
      this.cache = {}
    }
    return this.cache
  }

  private async persist(): Promise<void> {
    await fs.writeFile(this.file, JSON.stringify(this.cache ?? {}), { mode: 0o600 })
  }

  async set(key: string, value: string): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('OS secure storage is unavailable; refusing to store secret as plaintext.')
    }
    const store = await this.load()
    store[key] = safeStorage.encryptString(value).toString('base64')
    await this.persist()
    log.info('stored secret', { key }) // value never logged
  }

  async get(key: string): Promise<string | null> {
    if (!this.isAvailable()) return null
    const store = await this.load()
    const enc = store[key]
    if (!enc) return null
    try {
      return safeStorage.decryptString(Buffer.from(enc, 'base64'))
    } catch (err) {
      log.warn('failed to decrypt secret', { key, err })
      return null
    }
  }

  async delete(key: string): Promise<void> {
    const store = await this.load()
    delete store[key]
    await this.persist()
  }
}
