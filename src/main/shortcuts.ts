import type { BrowserWindow } from 'electron'
import { createLogger } from './logging'
import { events } from './events'
import type { PlatformAdapter } from './platform'
import { screenObserver } from './context/screen-observer'

const log = createLogger('shortcuts')

/**
 * Registers the global (system-wide) shortcuts. Actions are resolved from the user's
 * settings so they can be rebound; call setup() again to re-register after a change.
 * Click-through state is tracked here so the toggle shortcut works even when the UI
 * is not focused.
 */
let clickThrough = false

export function setupShortcuts(
  platform: PlatformAdapter,
  overlay: BrowserWindow,
  bindings: Record<string, string>
): void {
  platform.shortcuts.unregisterAll()

  const actions: Record<string, () => void> = {
    toggleOverlay: () => {
      if (overlay.isVisible()) overlay.hide()
      else {
        overlay.show()
        overlay.focus()
      }
    },
    askQuestion: () => {
      overlay.show()
      overlay.focus()
      events.shortcut({ action: 'askQuestion' })
    },
    toggleClickThrough: () => {
      clickThrough = !clickThrough
      platform.window.setClickThrough(overlay, clickThrough)
      events.status({ message: clickThrough ? 'Overlay is click-through' : 'Overlay is interactive' })
    },
    captureScreen: () => {
      void screenObserver.capture().then((snap) => {
        if (snap) events.status({ message: 'Captured screen context.' })
      })
      events.shortcut({ action: 'captureScreen' })
    }
  }

  for (const [action, accelerator] of Object.entries(bindings)) {
    const handler = actions[action]
    if (!handler || !accelerator) continue
    const ok = platform.shortcuts.register(accelerator, handler)
    if (!ok) log.warn('failed to register shortcut', { action, accelerator })
  }
  log.info('global shortcuts registered', { count: Object.keys(bindings).length })
}
