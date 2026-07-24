import { app, BrowserWindow, ipcMain } from 'electron'
import { createLogger } from './logging'
import { resolvePlatform } from './platform'
import { createOverlayWindow } from './overlay-window'
import { setEventTarget } from './events'
import { configStatus, getConfig } from './config'
import { registerAiIpc } from './ai/ask-service'
import { orchestrator, registerTranscriptionIpc } from './transcription/orchestrator'
import { registerContextIpc } from './context/context-engine'
import { IpcChannels } from '@shared/ipc'
import type { AppStatus } from '@shared/types'

const log = createLogger('main')

let overlay: BrowserWindow | null = null

export function getOverlayWindow(): BrowserWindow | null {
  return overlay
}

async function bootstrap(): Promise<void> {
  const platform = await resolvePlatform()
  getConfig() // triggers .env load + logs config health once at startup

  ipcMain.handle(IpcChannels.AppGetStatus, async (): Promise<AppStatus> => ({
    ready: true,
    config: configStatus(),
    platform: platform.system.describe(),
    transcribing: orchestrator.isActive()
  }))

  ipcMain.handle(IpcChannels.ConfigGet, async () => configStatus())
  ipcMain.handle(IpcChannels.ConfigValidate, async () => configStatus())

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

  registerAiIpc()
  registerTranscriptionIpc()
  registerContextIpc()

  overlay = createOverlayWindow(platform)
  setEventTarget(overlay)

  const status = configStatus()
  if (status.problems.length) {
    // Surface config problems to the UI as a friendly banner (never the key itself).
    overlay.webContents.once('did-finish-load', () => {
      overlay?.webContents.send(IpcChannels.EvtError, {
        scope: 'config',
        message: status.problems.join(' ')
      })
    })
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      overlay = createOverlayWindow(platform)
      setEventTarget(overlay)
    }
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
