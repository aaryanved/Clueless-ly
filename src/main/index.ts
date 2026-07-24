import { app, BrowserWindow, ipcMain } from 'electron'
import { createLogger } from './logging'
import { resolvePlatform } from './platform'
import { createOverlayWindow } from './overlay-window'
import { IpcChannels } from '@shared/ipc'
import type { AppStatus } from '@shared/types'

const log = createLogger('main')

let overlay: BrowserWindow | null = null

export function getOverlayWindow(): BrowserWindow | null {
  return overlay
}

async function bootstrap(): Promise<void> {
  const platform = await resolvePlatform()

  // Minimal status IPC — expanded in later batches (config, sessions, transcription).
  ipcMain.handle(IpcChannels.AppGetStatus, async (): Promise<AppStatus> => {
    return {
      ready: true,
      config: {
        openaiKeyPresent: false,
        openaiKeyLooksValid: false,
        model: 'unconfigured',
        transcriptionModel: 'unconfigured',
        realtimeModel: 'unconfigured',
        problems: ['Configuration is wired up in a later batch.']
      },
      platform: platform.system.describe(),
      transcribing: false
    }
  })

  ipcMain.handle(IpcChannels.PlatformInfo, async () => platform.system.describe())
  ipcMain.handle(IpcChannels.PlatformPermissionCheck, async (_e, kind) =>
    platform.permissions.check(kind)
  )
  ipcMain.handle(IpcChannels.PlatformPermissionRequest, async (_e, kind) =>
    platform.permissions.request(kind)
  )
  ipcMain.handle(IpcChannels.PlatformOpenPermissionSettings, async (_e, kind) =>
    platform.permissions.openSettings(kind)
  )

  overlay = createOverlayWindow(platform)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) overlay = createOverlayWindow(platform)
  })
}

app.whenReady().then(bootstrap).catch((err) => {
  log.error('bootstrap failed', err)
  app.quit()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', async () => {
  const platform = await resolvePlatform()
  await platform.dispose()
})
