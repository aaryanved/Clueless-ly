import { useState, type KeyboardEvent } from 'react'

// Captures a keyboard shortcut and reports it as an Electron accelerator string
// (e.g. "CommandOrControl+Shift+M"). Requires at least one modifier plus a key.

const MOD_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta'])

function toAccelerator(e: KeyboardEvent): string | null {
  const parts: string[] = []
  if (e.metaKey || e.ctrlKey) parts.push('CommandOrControl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  const key = e.key
  if (MOD_KEYS.has(key)) return null // modifier alone is not a valid accelerator
  if (!parts.length) return null // require at least one modifier
  let k = key
  if (k === ' ') k = 'Space'
  else if (k.length === 1) k = k.toUpperCase()
  else k = k.charAt(0).toUpperCase() + k.slice(1)
  parts.push(k)
  return parts.join('+')
}

function pretty(accel: string): string {
  return accel
    .replace('CommandOrControl', '⌘/Ctrl')
    .replace('Alt', '⌥ Option')
    .replace('Shift', '⇧')
    .replace(/\+/g, ' + ')
}

export function KeybindInput({
  value,
  onChange
}: {
  value: string
  onChange: (accel: string) => void
}): JSX.Element {
  const [capturing, setCapturing] = useState(false)

  return (
    <button
      className={capturing ? 'keybind keybind--capturing' : 'keybind'}
      onClick={() => setCapturing(true)}
      onBlur={() => setCapturing(false)}
      onKeyDown={(e) => {
        if (!capturing) return
        e.preventDefault()
        if (e.key === 'Escape') {
          setCapturing(false)
          return
        }
        const accel = toAccelerator(e)
        if (accel) {
          onChange(accel)
          setCapturing(false)
        }
      }}
    >
      {capturing ? 'Press keys…' : value ? pretty(value) : 'Set shortcut'}
    </button>
  )
}
