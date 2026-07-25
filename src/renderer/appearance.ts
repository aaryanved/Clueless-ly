import type { AppSettings } from '@shared/types'
import { setClickThroughMode } from './interactivity'

/**
 * Applies the visual + interaction settings to the live document: colour theme,
 * overlay opacity, and whether the window is a click-through ghost.
 */
export function applyAppearance(s: AppSettings): void {
  const root = document.documentElement
  root.dataset.theme = s.theme
  root.style.setProperty('--overlay-opacity', String(s.overlayOpacity))
  setClickThroughMode(s.clickThroughEnabled)
}
