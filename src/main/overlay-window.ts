import { join } from 'node:path'
import { BrowserWindow, shell } from 'electron'
import { createLogger } from './logging'
import type { PlatformAdapter } from './platform'
import type { WindowLayout } from '@shared/types'
import { computeLayoutBounds } from './window-layout'

const log = createLogger('overlay-window')

/**
 * Creates the always-on-top, frameless, transparent overlay window and applies the
 * platform's overlay behaviour (content protection, all-workspaces visibility, etc).
 */
export function createOverlayWindow(
  platform: PlatformAdapter,
  layout: WindowLayout = 'center'
): BrowserWindow {
  const bounds = computeLayoutBounds(layout)

  const win = new BrowserWindow({
    ...bounds,
    // Small minimums so the window can shrink to the side layout or the minimized pill.
    minWidth: 200,
    minHeight: 34,
    frame: false,
    transparent: true,
    resizable: true,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    fullscreenable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  platform.window.applyOverlayBehavior(win)

  win.once('ready-to-show', () => win.show())

  // Open real external links in the user's browser, never inside the overlay.
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    void win.loadURL(devUrl)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  log.info('overlay window created', {
    contentProtection: platform.window.supportsContentProtection()
  })
  return win
}
