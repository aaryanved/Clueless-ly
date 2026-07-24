// Platform resolver. On `dev` this always returns the cross-platform base adapter.
// The `mac` and `windows` branches replace the body of resolvePlatform() to return
// their native adapter (./darwin or ./win32). Keeping the swap isolated to this one
// file is what lets the shared core stay byte-for-byte identical across branches.

import { createLogger } from '../logging'
import type { PlatformAdapter } from './contracts'
import { createBaseAdapter } from './base'
import { createAdapter as createDarwinAdapter } from './darwin'

const log = createLogger('platform')

let cached: PlatformAdapter | null = null

export async function resolvePlatform(): Promise<PlatformAdapter> {
  if (cached) return cached
  // mac branch: use the native macOS adapter on darwin, fall back to base elsewhere
  // (e.g. running the shared core on a non-mac dev machine).
  cached = process.platform === 'darwin' ? createDarwinAdapter() : createBaseAdapter()
  await cached.init()
  log.info('resolved platform adapter', { id: cached.id, platform: process.platform })
  return cached
}

export function getPlatform(): PlatformAdapter {
  if (!cached) throw new Error('resolvePlatform() must be awaited before getPlatform()')
  return cached
}

export type { PlatformAdapter } from './contracts'
