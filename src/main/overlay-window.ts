import { join } from 'node:path'
import { BrowserWindow, screen, shell } from 'electron'
import { createLogger } from './logging'
import type { PlatformAdapter } from './platform'

const log = createLogger('overlay-window')

/**
 * Creates the always-on-top, frameless, transparent overlay window and applies the
 * platform's overlay behaviour (content protection, all-workspaces visibility, etc).
 */
export function createOverlayWindow(platform: PlatformAdapter): BrowserWindow {
  const primary = screen.getPrimaryDisplay()
  const width = 460
  const height = 640

  const win = new BrowserWindow({
    width,
    height,
    x: primary.workArea.x + primary.workArea.width - width - 24,
    y: primary.workArea.y + 48,
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
