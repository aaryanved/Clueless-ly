import { useStore } from '../state/store'
import type { AppSettings } from '@shared/types'
import { KeybindInput } from './KeybindInput'

export function SettingsPanel(): JSX.Element {
  const { state, dispatch } = useStore()
  const settings = state.settings

  async function patch(p: Partial<AppSettings>): Promise<void> {
    try {
      const next = await window.clueless.settings.set(p)
      dispatch({ type: 'setSettings', settings: next })
    } catch (err) {
      dispatch({ type: 'banner', banner: { kind: 'error', text: `Settings: ${String(err)}` } })
    }
  }

  const opacityPct = Math.round((settings?.overlayOpacity ?? 0.52) * 100)

  return (
    <div className="panel panel--scroll">
      <section className="group">
        <h3>Appearance</h3>
        <div className="row">
          <span>Theme</span>
          <div className="drawer__switch">
            <button
              className={settings?.theme === 'dark' ? 'seg-btn seg-btn--on' : 'seg-btn'}
              onClick={() => patch({ theme: 'dark' })}
            >
              Dark
            </button>
            <button
              className={settings?.theme === 'light' ? 'seg-btn seg-btn--on' : 'seg-btn'}
              onClick={() => patch({ theme: 'light' })}
            >
              Light
            </button>
          </div>
        </div>
        <div className="row">
          <span>Opacity</span>
          <span className="muted small">{opacityPct}%</span>
        </div>
        <input
          className="slider"
          type="range"
          min={0.2}
          max={1}
          step={0.02}
          value={settings?.overlayOpacity ?? 0.52}
          onChange={(e) => patch({ overlayOpacity: Number(e.target.value) })}
        />
        <div className="row">
          <span>Window</span>
          <div className="drawer__switch">
            <button
              className={settings?.windowLayout === 'left' ? 'seg-btn seg-btn--on' : 'seg-btn'}
              onClick={() => patch({ windowLayout: 'left' })}
            >
              Left
            </button>
            <button
              className={settings?.windowLayout === 'center' ? 'seg-btn seg-btn--on' : 'seg-btn'}
              onClick={() => patch({ windowLayout: 'center' })}
            >
              Center
            </button>
            <button
              className={settings?.windowLayout === 'right' ? 'seg-btn seg-btn--on' : 'seg-btn'}
              onClick={() => patch({ windowLayout: 'right' })}
            >
              Right
            </button>
          </div>
        </div>
      </section>

      <section className="group">
        <h3>Behavior</h3>
        <Toggle
          label="Click through overlay"
          checked={!!settings?.clickThroughEnabled}
          onChange={(v) => patch({ clickThroughEnabled: v })}
        />
        <Toggle
          label="Hide from screen sharing"
          checked={!!settings?.contentProtectionEnabled}
          onChange={(v) => {
            void window.clueless.overlay.setContentProtection(v)
            void patch({ contentProtectionEnabled: v })
          }}
        />
      </section>

      <section className="group">
        <h3>Capture</h3>
        <Toggle
          label="Push-to-talk mic"
          checked={!!settings?.pushToTalk}
          onChange={(v) => patch({ pushToTalk: v })}
        />
        <p className="muted small">
          When on, only device audio is transcribed and your mic turns on only while the
          talk key is active — keeping your voice apart from device audio.
        </p>
        {settings?.pushToTalk && (
          <div className="row">
            <span>Talk key</span>
            <KeybindInput
              value={settings?.shortcuts?.talk ?? 'CommandOrControl+Shift+M'}
              onChange={(accel) =>
                patch({ shortcuts: { ...(settings?.shortcuts ?? {}), talk: accel } })
              }
            />
          </div>
        )}
        <Toggle
          label="Microphone"
          checked={!!settings?.microphoneEnabled}
          onChange={(v) => patch({ microphoneEnabled: v })}
        />
        <Toggle
          label="System audio"
          checked={!!settings?.systemAudioEnabled}
          onChange={(v) => patch({ systemAudioEnabled: v })}
        />
        <Toggle
          label="Screen context"
          checked={!!settings?.captureScreenContext}
          onChange={(v) => patch({ captureScreenContext: v })}
        />
      </section>
    </div>
  )
}

function Toggle(props: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}): JSX.Element {
  return (
    <label className="row toggle">
      <span>{props.label}</span>
      <input type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
    </label>
  )
}
