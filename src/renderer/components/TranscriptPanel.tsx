import { useStore } from '../state/store'

export function TranscriptPanel(): JSX.Element {
  const { state, dispatch } = useStore()

  async function toggle(): Promise<void> {
    try {
      if (state.transcribing) await window.clueless.transcription.stop()
      else await window.clueless.transcription.start()
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
