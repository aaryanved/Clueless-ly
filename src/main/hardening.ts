import { app, shell } from 'electron'
import { createLogger } from './logging'

const log = createLogger('hardening')

/**
 * Baseline security hardening applied to every web contents:
 *  - single-instance lock (a second launch focuses the existing overlay),
 *  - block in-app navigation to arbitrary origins,
 *  - deny creation of extra windows (external links open in the real browser),
 *  - forbid <webview> embedding.
 * The renderer additionally runs under a strict CSP with contextIsolation on and
 * nodeIntegration off (see index.html and overlay-window.ts).
 */
export function requestSingleInstance(): boolean {
  const gotLock = app.requestSingleInstanceLock()
  if (!gotLock) {
    log.warn('another instance is already running; quitting')
    app.quit()
  }
  return gotLock
}

export function applyWebContentsHardening(): void {
  app.on('web-contents-created', (_e, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      if (/^https?:/.test(url)) void shell.openExternal(url)
      return { action: 'deny' }
    })

    contents.on('will-navigate', (event, url) => {
      const isDevServer = !!process.env['ELECTRON_RENDERER_URL'] && url.startsWith(process.env['ELECTRON_RENDERER_URL']!)
      const isLocalFile = url.startsWith('file://')
      if (!isDevServer && !isLocalFile) {
        event.preventDefault()
        log.warn('blocked navigation', { url })
      }
    })

    contents.on('will-attach-webview', (event) => {
      event.preventDefault()
      log.warn('blocked webview attach')
    })
  })
}
