// Per-role live input level (0..1), fed by the capture graph and read by the soundwave
// indicators. 'me' = microphone, 'them' = system audio. Kept outside React so the audio
// callback can update cheaply without re-rendering every frame.

export type LevelRole = 'me' | 'them'
type Listener = (level: number) => void

const levels: Record<LevelRole, number> = { me: 0, them: 0 }
const listeners: Record<LevelRole, Set<Listener>> = { me: new Set(), them: new Set() }

export function setAudioLevel(role: LevelRole, level: number): void {
  // Smooth a little so meters glide rather than jitter.
  levels[role] = levels[role] * 0.6 + Math.min(1, level) * 0.4
  for (const l of listeners[role]) l(levels[role])
}

export function getAudioLevel(role: LevelRole): number {
  return levels[role]
}

export function onAudioLevel(role: LevelRole, fn: Listener): () => void {
  listeners[role].add(fn)
  return () => listeners[role].delete(fn)
}
