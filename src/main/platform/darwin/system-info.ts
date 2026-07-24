import os from 'node:os'
import { app } from 'electron'
import type { SystemInfoAdapter } from '../contracts'
import type { Platform, PlatformDescription } from '@shared/types'

export class DarwinSystemInfo implements SystemInfoAdapter {
  readonly platform: Platform = 'darwin'

  describe(): PlatformDescription {
    return {
      id: 'darwin',
      displayName: 'macOS',
      osVersion: process.getSystemVersion?.() ?? os.release(),
      arch: process.arch,
      appVersion: app.getVersion(),
      contentProtection: {
        supported: true,
        notes: 'NSWindowSharingNone via setContentProtection excludes the overlay from capture.'
      },
      systemAudio: {
        supported: true,
        method: 'screencapturekit',
        notes: 'ScreenCaptureKit system audio (macOS 13+); needs Screen Recording permission.'
      }
    }
  }
}
