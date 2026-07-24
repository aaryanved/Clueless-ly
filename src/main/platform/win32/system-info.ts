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
        // Enabled in the WASAPI batch; reported as unsupported until then.
        supported: false,
        method: 'none',
        notes: 'WASAPI loopback system audio is enabled in a later batch.'
      }
    }
  }
}
