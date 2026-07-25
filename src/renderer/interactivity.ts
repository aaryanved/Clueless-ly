// Click-through control via pointer hit-testing.
//
// The overlay is a click-through "ghost" by default (the OS window ignores the mouse
// and forwards move events). On every forwarded mousemove we hit-test the point: if it
// lands on an element marked `data-interactive` (or inside one), we make the window
// capture the mouse so clicks/scroll/selection work; otherwise clicks pass through to
// whatever is behind. This is far more reliable than React onMouseEnter/Leave, which do
// not fire consistently while the window is in forwarded-mouse mode.

let clickThrough = true
let forced = 0 // >0 => always interactive (e.g. drawer or pill open)
let currentlyInteractive = false

function setNative(want: boolean): void {
  if (want === currentlyInteractive) return
  currentlyInteractive = want
  void window.clueless.overlay.setInteractive(want)
}

function interactiveAt(x: number, y: number): boolean {
  const el = document.elementFromPoint(x, y)
  return !!(el && el.closest('[data-interactive]'))
}

function onMove(e: MouseEvent): void {
  if (!clickThrough || forced > 0) {
    setNative(true)
    return
  }
  setNative(interactiveAt(e.clientX, e.clientY))
}

/** Install the global pointer tracking. Call once at startup. */
export function initInteractivity(): void {
  window.addEventListener('mousemove', onMove, { passive: true })
  // Pointer left the window entirely -> let clicks pass through again.
  document.addEventListener('mouseleave', () => {
    if (clickThrough && forced === 0) setNative(false)
  })
}

/** Toggle between ghost (click-through) and fully-interactive modes. */
export function setClickThroughMode(enabled: boolean): void {
  clickThrough = enabled
  if (!enabled) setNative(true)
}

/** Force interactivity on (ref-counted) while a modal surface is open. */
export function enterInteractive(): void {
  forced += 1
  setNative(true)
}
export function leaveInteractive(): void {
  forced = Math.max(0, forced - 1)
}

/** Marker spread onto elements that should capture the mouse in ghost mode. */
export function interactiveProps(): { 'data-interactive': string } {
  return { 'data-interactive': 'true' }
}
