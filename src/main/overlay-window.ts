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
  const wa = primary.workArea
  // Large, centered overlay (roughly two-thirds of the work area).
  const width = Math.min(1180, Math.round(wa.width * 0.74))
  const height = Math.min(760, Math.round(wa.height * 0.74))

  const win = new BrowserWindow({
    width,
    height,
    minWidth: 720,
    minHeight: 460,
    x: wa.x + Math.round((wa.width - width) / 2),
    // Sit in the upper portion of the screen rather than dead-centre.
    y: wa.y + Math.max(24, Math.round((wa.height - height) * 0.22)),
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
