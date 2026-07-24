import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { createLogger } from '../logging'
import type { StorageAdapter } from './storage-adapter'

const log = createLogger('storage')

/**
 * Simple JSON-file store under the OS userData directory. Writes are atomic
 * (write-temp-then-rename) so a crash mid-write cannot corrupt existing data.
 */
export class JsonStore implements StorageAdapter {
  private dir = join(app.getPath('userData'), 'data')

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true })
  }

  private fileFor(key: string): string {
    const safe = key.replace(/[^a-z0-9_-]/gi, '_')
    return join(this.dir, `${safe}.json`)
  }

  async readJson<T>(key: string): Promise<T | null> {
    try {
      const raw = await fs.readFile(this.fileFor(key), 'utf8')
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }

  async writeJson<T>(key: string, value: T): Promise<void> {
    await this.ensureDir()
    const target = this.fileFor(key)
    const tmp = `${target}.${process.pid}.tmp`
    await fs.writeFile(tmp, JSON.stringify(value, null, 2), 'utf8')
    await fs.rename(tmp, target)
    log.debug('wrote store', { key })
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.fileFor(key), { force: true })
  }
}

export const store = new JsonStore()
