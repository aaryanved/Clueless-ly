import { useEffect, useRef } from 'react'
import { onAudioLevel, type LevelRole } from '../audio/level'

// A small live soundwave: a row of bars whose heights react to the input level of a
// given role, so the user can see audio is being picked up before text appears.
const BARS = 4

export function Soundwave({ active, role }: { active: boolean; role: LevelRole }): JSX.Element {
  const barsRef = useRef<Array<HTMLSpanElement | null>>([])
  const levelRef = useRef(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const unsub = onAudioLevel(role, (l) => {
      levelRef.current = l
    })
    return unsub
  }, [role])

  useEffect(() => {
    if (!active) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      barsRef.current.forEach((b) => b && (b.style.transform = 'scaleY(0.18)'))
      return
    }
    // Each bar gets its own phase so idle motion looks organic; amplitude tracks level.
    let t = 0
    const tick = (): void => {
      t += 0.18
      const level = levelRef.current
      barsRef.current.forEach((bar, i) => {
        if (!bar) return
        const wobble = 0.5 + 0.5 * Math.sin(t + i * 0.9)
        const idle = 0.18 + 0.12 * wobble
        const h = Math.max(idle, Math.min(1, level * (0.7 + 0.6 * wobble)))
        bar.style.transform = `scaleY(${h.toFixed(3)})`
      })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [active])

  return (
    <span className="wave" data-active={active ? 'yes' : 'no'} aria-hidden>
      {Array.from({ length: BARS }).map((_, i) => (
        <span key={i} className="wave__bar" ref={(el) => (barsRef.current[i] = el)} />
      ))}
    </span>
  )
}
