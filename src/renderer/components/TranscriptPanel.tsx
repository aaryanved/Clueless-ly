import { useEffect, useRef } from 'react'
import { useStore } from '../state/store'
import { interactiveProps } from '../interactivity'
import { Soundwave } from './Soundwave'

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
      <div className="transcript-col__head" {...interactiveProps()}>
        <span className="transcript-col__title">
          Live transcript
          <Soundwave active={state.transcribing} />
        </span>
        <button className="link-btn" onClick={() => dispatch({ type: 'clearTranscript' })}>
          Clear
        </button>
      </div>
      <div className="transcript" {...interactiveProps()}>
        {state.transcript.length === 0 && (
          <p className="muted small">
            {state.transcribing
              ? 'Listening… speech will appear here.'
              : 'Press Listen to capture microphone + system audio.'}
          </p>
        )}
        {state.transcript.map((s) => (
          <button
            key={s.id}
            className={`seg seg--${s.role}`}
            data-final={s.isFinal}
            title="Click to ask about this line"
            onClick={() => s.text.trim() && dispatch({ type: 'prefillAsk', text: s.text.trim() })}
          >
            <span className="seg__who">{s.role === 'me' ? 'You' : s.role === 'them' ? 'Them' : '·'}</span>
            <span className="seg__text">{s.text}</span>
          </button>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  )
}
