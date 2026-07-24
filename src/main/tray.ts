import { app, Menu, nativeImage, Tray, type BrowserWindow } from 'electron'
import { createLogger } from './logging'

const log = createLogger('tray')

let tray: Tray | null = null

/**
 * Menu-bar / tray entry. On macOS the app runs as an accessory (no Dock icon), so the
 * tray is the primary way to show/hide the overlay and quit.
 */
export function createTray(overlay: BrowserWindow): Tray {
  tray = new Tray(nativeImage.createEmpty())
  // macOS renders a text title in the menu bar; Windows relies on the icon/tooltip.
  tray.setTitle('◍ Clueless')
  tray.setToolTip('Clueless-ly')

  const rebuild = (): void => {
    const visible = !overlay.isDestroyed() && overlay.isVisible()
    tray?.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: visible ? 'Hide overlay' : 'Show overlay',
          click: () => {
            if (overlay.isVisible()) overlay.hide()
            else {
              overlay.show()
              overlay.focus()
            }
          }
        },
        { type: 'separator' },
        { label: 'Quit Clueless-ly', click: () => app.quit() }
      ])
    )
  }

  rebuild()
  overlay.on('show', rebuild)
  overlay.on('hide', rebuild)
  log.info('tray created')
  return tray
}
