import { useStore } from '../state/store'
import { captureManager } from '../audio/capture'

export function TranscriptPanel(): JSX.Element {
  const { state, dispatch } = useStore()
  const settings = state.settings

  async function start(): Promise<void> {
    await window.clueless.transcription.start()
    if (settings?.microphoneEnabled !== false) {
      try {
        await captureManager.startMicrophone()
      } catch (err) {
        dispatch({
          type: 'banner',
          banner: { kind: 'error', text: `Microphone unavailable: ${String(err)}. Grant access in System Settings.` }
        })
        void window.clueless.platform.openPermissionSettings('microphone')
      }
    }
    if (settings?.systemAudioEnabled && state.status?.platform.systemAudio.supported) {
      try {
        await captureManager.startSystemAudio()
      } catch (err) {
        dispatch({
          type: 'banner',
          banner: {
            kind: 'error',
            text: `System audio unavailable: ${String(err)}. Grant Screen Recording permission.`
          }
        })
        void window.clueless.platform.openPermissionSettings('screen')
      }
    }
  }

  async function stop(): Promise<void> {
    captureManager.stopAll()
    await window.clueless.transcription.stop()
  }

  async function toggle(): Promise<void> {
    try {
      if (state.transcribing) await stop()
      else await start()
    } catch (err) {
      dispatch({ type: 'banner', banner: { kind: 'error', text: `Transcription: ${String(err)}` } })
    }
  }

  return (
    <div className="panel">
      <div className="panel__actions">
        <button className={state.transcribing ? 'btn btn--live' : 'btn'} onClick={() => void toggle()}>
          {state.transcribing ? '● Listening — Stop' : 'Start listening'}
        </button>
        <button className="btn btn--ghost" onClick={() => dispatch({ type: 'clearTranscript' })}>
          Clear
        </button>
      </div>
      <div className="transcript">
        {state.transcript.length === 0 && (
          <p className="muted">
            No transcript yet. Start listening to capture microphone and system audio.
          </p>
        )}
        {state.transcript.map((s) => (
          <div key={s.id} className={`seg seg--${s.role}`} data-final={s.isFinal}>
            <span className="seg__who">{s.role === 'me' ? 'You' : s.role === 'them' ? 'Them' : '·'}</span>
            <span className="seg__text">{s.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
