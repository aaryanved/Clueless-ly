// Controls the overlay's click-through behaviour. The window is click-through by
// default; hovering an interactive region (chat box, settings gear, open drawer) tells
// the main process to capture the mouse there so clicks land, then releases it on exit.
// A reference count prevents flicker when the pointer moves between adjacent regions.

let count = 0
let applied = false

function apply(): void {
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
