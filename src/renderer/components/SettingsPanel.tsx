import { useStore } from '../state/store'
import type { AppSettings } from '@shared/types'

export function SettingsPanel(): JSX.Element {
  const { state, dispatch } = useStore()
  const settings = state.settings
  const cfg = state.status?.config
  const plat = state.status?.platform

  async function patch(p: Partial<AppSettings>): Promise<void> {
    try {
      const next = await window.clueless.settings.set(p)
      dispatch({ type: 'setSettings', settings: next })
    } catch (err) {
      dispatch({ type: 'banner', banner: { kind: 'error', text: `Settings: ${String(err)}` } })
    }
  }

  return (
    <div className="panel panel--scroll">
      <section className="group">
        <h3>OpenAI</h3>
        <div className="row">
          <span>API key</span>
          <span className={cfg?.openaiKeyPresent ? 'ok' : 'bad'}>
            {cfg?.openaiKeyPresent ? (cfg.openaiKeyLooksValid ? 'Configured' : 'Present (check format)') : 'Missing'}
          </span>
        </div>
        <div className="row">
          <span>Answer model</span>
          <span className="muted">{cfg?.model ?? '—'}</span>
        </div>
        <div className="row">
          <span>Realtime model</span>
          <span className="muted">{cfg?.realtimeModel ?? '—'}</span>
        </div>
        {cfg?.problems?.length ? (
          <ul className="problems">
            {cfg.problems.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="group">
        <h3>Capture</h3>
        <Toggle
          label="Microphone"
          checked={!!settings?.microphoneEnabled}
          onChange={(v) => patch({ microphoneEnabled: v })}
        />
        <Toggle
          label="System audio"
          checked={!!settings?.systemAudioEnabled}
          onChange={(v) => patch({ systemAudioEnabled: v })}
          hint={plat?.systemAudio.supported ? plat.systemAudio.method : 'not supported on this build'}
        />
        <Toggle
          label="Screen context"
          checked={!!settings?.captureScreenContext}
          onChange={(v) => patch({ captureScreenContext: v })}
        />
      </section>

      <section className="group">
        <h3>Overlay privacy</h3>
        <Toggle
          label="Hide from screen sharing"
          checked={!!settings?.contentProtectionEnabled}
          onChange={(v) => {
            void window.clueless.overlay.setContentProtection(v)
            void patch({ contentProtectionEnabled: v })
          }}
          hint={plat?.contentProtection.supported ? 'supported' : 'unsupported on this OS'}
        />
        <p className="muted small">{plat?.contentProtection.notes}</p>
      </section>
    </div>
  )
}

function Toggle(props: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  hint?: string
}): JSX.Element {
  return (
    <label className="row toggle">
      <span>
        {props.label}
        {props.hint && <em className="muted small"> — {props.hint}</em>}
      </span>
      <input type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
    </label>
  )
}
