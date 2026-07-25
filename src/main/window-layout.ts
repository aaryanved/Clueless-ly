import { screen, type BrowserWindow, type Rectangle } from 'electron'
import type { WindowLayout } from '@shared/types'

// Window sizing/positioning for the three layouts plus the minimized "notch" pill.

const PILL = { width: 148, height: 30 }
let savedBounds: Rectangle | null = null

export function computeLayoutBounds(layout: WindowLayout): Rectangle {
  const wa = screen.getPrimaryDisplay().workArea
  if (layout === 'left' || layout === 'right') {
    const width = Math.min(460, Math.round(wa.width * 0.32))
    const height = Math.round(wa.height * 0.82)
    const y = wa.y + Math.round((wa.height - height) / 2)
    const x = layout === 'left' ? wa.x + 24 : wa.x + wa.width - width - 24
    return { x, y, width, height }
  }
  // center: large, sitting in the upper portion
  const width = Math.min(1180, Math.round(wa.width * 0.74))
  const height = Math.min(760, Math.round(wa.height * 0.74))
  const x = wa.x + Math.round((wa.width - width) / 2)
  const y = wa.y + Math.max(24, Math.round((wa.height - height) * 0.22))
  return { x, y, width, height }
}

export function applyLayout(win: BrowserWindow, layout: WindowLayout): void {
  win.setBounds(computeLayoutBounds(layout), false)
}

export function minimizeToPill(win: BrowserWindow): void {
  savedBounds = win.getBounds()
  const wa = screen.getPrimaryDisplay().workArea
  const x = wa.x + Math.round((wa.width - PILL.width) / 2)
  const y = wa.y + 8
  win.setBounds({ x, y, width: PILL.width, height: PILL.height }, false)
}

export function restoreFromPill(win: BrowserWindow, layout: WindowLayout): void {
  const bounds = savedBounds ?? computeLayoutBounds(layout)
  savedBounds = null
  win.setBounds(bounds, false)
}
