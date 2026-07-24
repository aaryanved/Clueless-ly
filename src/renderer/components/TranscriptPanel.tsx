import { useEffect, useRef } from 'react'
import { useStore } from '../state/store'

/** Live transcript column. Segments stream in from the transcription orchestrator. */
export function TranscriptPanel(): JSX.Element {
  const { state, dispatch } = useStore()
  const endRef = useRef<HTMLDivElement>(null)

  // Keep the newest segment in view.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [state.transcript.length])

  return (
    <div className="transcript-col">
      <div className="transcript-col__head">
        <span className="transcript-col__title">
          Live transcript
          {state.transcribing && <span className="live-dot" title="Listening" />}
        </span>
        <button className="link-btn" onClick={() => dispatch({ type: 'clearTranscript' })}>
          Clear
        </button>
      </div>
      <div className="transcript">
        {state.transcript.length === 0 && (
          <p className="muted small">
            {state.transcribing
              ? 'Listening… speech will appear here.'
              : 'Press Listen to capture microphone + system audio.'}
          </p>
        )}
        {state.transcript.map((s) => (
          <div key={s.id} className={`seg seg--${s.role}`} data-final={s.isFinal}>
            <span className="seg__who">{s.role === 'me' ? 'You' : s.role === 'them' ? 'Them' : '·'}</span>
            <span className="seg__text">{s.text}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  )
}
