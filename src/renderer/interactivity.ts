// Controls the overlay's click-through behaviour. When click-through is ON, the window
// is click-through by default and hovering an interactive region (chat box, gear, open
// drawer) tells the main process to capture the mouse there. When click-through is OFF,
// the whole window is interactive and the region logic is bypassed. A reference count
// prevents flicker when the pointer moves between adjacent regions.

let count = 0
let applied = false
let clickThrough = true

function apply(): void {
  if (!clickThrough) return // window is fully interactive; nothing to toggle
  const want = count > 0
  if (want !== applied) {
    applied = want
    void window.clueless.overlay.setInteractive(want)
  }
}

export function enterInteractive(): void {
  count += 1
  apply()
}

export function leaveInteractive(): void {
  count = Math.max(0, count - 1)
  apply()
}

/** Switch between ghost (click-through) and fully-interactive modes. */
export function setClickThroughMode(enabled: boolean): void {
  clickThrough = enabled
  if (!enabled) {
    // Fully interactive: capture the mouse everywhere.
    applied = true
    void window.clueless.overlay.setInteractive(true)
  } else {
    // Ghost: interactive only where a region is currently hovered.
    applied = count > 0
    void window.clueless.overlay.setInteractive(applied)
  }
}

/**
 * Spread onto any element that must remain clickable while the rest of the overlay is
 * click-through: `<div {...interactiveProps()}>`.
 */
export function interactiveProps(): {
  onMouseEnter: () => void
  onMouseLeave: () => void
} {
  return { onMouseEnter: enterInteractive, onMouseLeave: leaveInteractive }
}
