import { useStore } from '../state/store'
import type { AppModes, AppSettings } from '@shared/types'

const MODES: { key: keyof AppModes; label: string; desc: string; disabled?: boolean }[] = [
  { key: 'coding', label: 'Coding', desc: 'Prioritise correct, complete code solutions. Hides the transcript (toggle it back anytime).' },
  { key: 'interview', label: 'Interview', desc: 'Comprehensive, read-aloud answers grounded in your Context material.' },
  { key: 'speech', label: 'Speech', desc: 'Present a speech/PPT, then answer audience questions in line with it.' },
  { key: 'debate', label: 'Debate', desc: 'Not implemented yet.', disabled: true }
]

export function ModesPanel(): JSX.Element {
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
          <label key={m.key} className={`mode-row${m.disabled ? ' mode-row--off' : ''}`}>
            <div className="mode-row__text">
              <span className="mode-row__label">{m.label}</span>
              <span className="mode-row__desc">{m.desc}</span>
            </div>
            <input
              type="checkbox"
              disabled={m.disabled}
              checked={!!modes?.[m.key]}
              onChange={(e) => void toggle(m.key, e.target.checked)}
            />
          </label>
        ))}
        {technical && (
          <p className="mode-hint">Technical interview mode is active.</p>
        )}
      </section>
    </div>
  )
}
