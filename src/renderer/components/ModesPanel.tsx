import { useStore } from '../state/store'
import type { AppModes, AppSettings } from '@shared/types'
import { Switch } from './Switch'

const MODES: { key: keyof AppModes; label: string; desc: string; hasContext?: boolean; disabled?: boolean }[] = [
  { key: 'coding', label: 'Coding', desc: 'Prioritise correct, complete code solutions. Hides the transcript (toggle it back anytime).' },
  { key: 'interview', label: 'Interview', desc: 'Comprehensive, read-aloud answers grounded in the interview material you provide.', hasContext: true },
  { key: 'speech', label: 'Speech', desc: 'Present a speech/PPT, then answer audience questions in line with it.', hasContext: true }
]

/** onOpenContext navigates the drawer to a mode's context sub-view (e.g. interview). */
export function ModesPanel({ onOpenContext }: { onOpenContext: (mode: keyof AppModes) => void }): JSX.Element {
  const { state, dispatch } = useStore()
  const modes = state.settings?.modes

  async function toggle(key: keyof AppModes, value: boolean): Promise<void> {
    if (!modes) return
    const nextModes: AppModes = { ...modes, [key]: value }
    try {
      const next = await window.clueless.settings.set({ modes: nextModes } as Partial<AppSettings>)
      dispatch({ type: 'setSettings', settings: next })
    } catch (err) {
      dispatch({ type: 'banner', banner: { kind: 'error', text: `Modes: ${String(err)}` } })
    }
  }

  const technical = !!modes?.coding && !!modes?.interview

  return (
    <div className="panel panel--scroll">
      <section className="group">
        <h3>Modes</h3>
        <p className="muted small">
          Modes stack. Turn on both Coding and Interview for a technical-interview flow
          (code on the left, a spoken walkthrough in the centre).
        </p>
        {MODES.map((m) => (
          <div key={m.key} className={`mode-row${m.disabled ? ' mode-row--off' : ''}`}>
            <div className="mode-row__text">
              <span className="mode-row__label">{m.label}</span>
              <span className="mode-row__desc">{m.desc}</span>
            </div>
            <div className="mode-row__ctrls">
              {m.hasContext && !m.disabled && (
                <button
                  className="chevron-btn"
                  title={`${m.label} context`}
                  onClick={() => onOpenContext(m.key)}
                >
                  <Chevron />
                </button>
              )}
              <Switch
                checked={!!modes?.[m.key]}
                disabled={m.disabled}
                onChange={(v) => void toggle(m.key, v)}
              />
            </div>
          </div>
        ))}
        {technical && <p className="mode-hint">Technical interview mode is active.</p>}
      </section>
    </div>
  )
}

function Chevron(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}
