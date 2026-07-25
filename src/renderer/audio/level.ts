// A tiny observable for live input level (0..1), fed by the capture graph and read by
// the soundwave indicator. Kept outside React so the audio callback can update it
// cheaply without re-rendering on every frame.

type Listener = (level: number) => void

const listeners = new Set<Listener>()
let current = 0

export function setAudioLevel(level: number): void {
  // Smooth a little so the meter glides rather than jitters.
  current = current * 0.6 + Math.min(1, level) * 0.4
  for (const l of listeners) l(current)
}

export function getAudioLevel(): number {
  return current
}

export function onAudioLevel(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
