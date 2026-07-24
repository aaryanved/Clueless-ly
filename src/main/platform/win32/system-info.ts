import os from 'node:os'
import { app } from 'electron'
import type { SystemInfoAdapter } from '../contracts'
import type { Platform, PlatformDescription } from '@shared/types'

export class Win32SystemInfo implements SystemInfoAdapter {
  readonly platform: Platform = 'win32'

  describe(): PlatformDescription {
    return {
      id: 'win32',
      displayName: 'Windows',
      osVersion: process.getSystemVersion?.() ?? os.release(),
      arch: process.arch,
      appVersion: app.getVersion(),
      contentProtection: {
        supported: true,
        notes: 'WDA_EXCLUDEFROMCAPTURE via setContentProtection (Windows 10 2004+).'
      },
      systemAudio: {
        supported: true,
        method: 'wasapi-loopback',
        notes: 'WASAPI loopback captures the current default render device (Windows 10+).'
      }
    }
  }
}
