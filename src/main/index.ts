import { app, BrowserWindow, ipcMain } from 'electron'
import { createLogger } from './logging'
import { resolvePlatform } from './platform'
import { createOverlayWindow } from './overlay-window'
import { setEventTarget } from './events'
import { configStatus, getConfig } from './config'
import { registerAiIpc } from './ai/ask-service'
import { orchestrator, registerTranscriptionIpc } from './transcription/orchestrator'
import { registerAutoAnswer } from './transcription/auto-answer'
import { registerContextIpc, contextEngine } from './context/context-engine'
import { sessionManager, registerSessionsIpc } from './sessions/session-manager'
import { settingsService, registerSettingsIpc } from './settings/settings-service'
import { defaultSettings } from './settings/defaults'
import { setupShortcuts } from './shortcuts'
import { setupDisplayMediaHandler } from './capture-grant'
import { createTray } from './tray'
import { applyWebContentsHardening, requestSingleInstance } from './hardening'
import { IpcChannels } from '@shared/ipc'
import type { AppStatus } from '@shared/types'

const log = createLogger('main')

let overlay: BrowserWindow | null = null

export function getOverlayWindow(): BrowserWindow | null {
  return overlay
}

async function bootstrap(): Promise<void> {
  applyWebContentsHardening()
  const platform = await resolvePlatform()
  getConfig() // triggers .env load + logs config health once at startup
  await sessionManager.init()
  await settingsService.init(defaultSettings(platform))

  const initial = settingsService.get()
  contextEngine.setMaxTokens(initial.maxContextTokens)

  ipcMain.handle(IpcChannels.AppGetStatus, async (): Promise<AppStatus> => ({
    ready: true,
    config: configStatus(),
    platform: platform.system.describe(),
    activeSessionId: sessionManager.activeId(),
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
  ipcMain.handle(IpcChannels.PlatformAudioSources, async () => platform.screen.listSources())

  ipcMain.handle(IpcChannels.AppQuit, async () => app.quit())

  registerAiIpc()
  registerTranscriptionIpc()
  registerAutoAnswer()
  registerContextIpc()
  registerSessionsIpc()
  registerSettingsIpc()

  setupDisplayMediaHandler(platform)

  overlay = createOverlayWindow(platform)
  setEventTarget(overlay)
  platform.window.setContentProtection(overlay, initial.contentProtectionEnabled)
  setupShortcuts(platform, overlay, initial.shortcuts)
  createTray(overlay)

  // Start click-through per the saved setting: mouse events pass through to whatever
  // is behind, except where the renderer re-enables interactivity (chat box, gear).
  overlay.setIgnoreMouseEvents(initial.clickThroughEnabled, { forward: true })

  // Overlay UX controls.
  ipcMain.handle(IpcChannels.OverlaySetInteractive, async (_e, enabled: boolean) => {
    // enabled=true  -> window captures the mouse (interactive region hovered)
    // enabled=false -> window ignores the mouse and forwards move events
    if (overlay) overlay.setIgnoreMouseEvents(!enabled, { forward: true })
  })
  ipcMain.handle(IpcChannels.OverlayToggleClickThrough, async (_e, enabled: boolean) => {
    if (overlay) platform.window.setClickThrough(overlay, enabled)
  })
  ipcMain.handle(IpcChannels.OverlaySetContentProtection, async (_e, enabled: boolean) => {
    if (overlay) platform.window.setContentProtection(overlay, enabled)
  })
  ipcMain.handle(IpcChannels.OverlayHide, async () => overlay?.hide())
  ipcMain.handle(IpcChannels.OverlayShow, async () => {
    overlay?.show()
    overlay?.focus()
  })

  // Apply settings side effects on change.
  settingsService.onChange((next, patch) => {
    if (patch.contentProtectionEnabled !== undefined && overlay) {
      platform.window.setContentProtection(overlay, next.contentProtectionEnabled)
    }
    if (patch.maxContextTokens !== undefined) contextEngine.setMaxTokens(next.maxContextTokens)
    if (patch.shortcuts && overlay) setupShortcuts(platform, overlay, next.shortcuts)
  })

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
      platform.window.setContentProtection(overlay, settingsService.get().contentProtectionEnabled)
      setupShortcuts(platform, overlay, settingsService.get().shortcuts)
    }
  })
}

if (requestSingleInstance()) {
  app.on('second-instance', () => {
    if (overlay) {
      overlay.show()
      overlay.focus()
    }
  })

  app.whenReady().then(bootstrap).catch((err) => {
    log.error('bootstrap failed', err)
    app.quit()
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', async () => {
  const platform = await resolvePlatform()
  await platform.dispose()
})
