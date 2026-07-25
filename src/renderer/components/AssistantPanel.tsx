import { useEffect, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { interactiveProps } from '../interactivity'
import { Markdown } from './Markdown'

export function AssistantPanel(): JSX.Element {
  const { state, dispatch } = useStore()
  const [question, setQuestion] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Keep the latest answer in view as tokens stream in.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [state.messages])

  // Clicking a transcript line drops its text into the ask box, ready to send.
  useEffect(() => {
    if (state.prefill.bump === 0) return
    setQuestion(state.prefill.text)
    inputRef.current?.focus()
  }, [state.prefill.bump])

  async function ask(): Promise<void> {
    const q = question.trim()
    if (!q) return
    setQuestion('')
    try {
      const { requestId } = await window.clueless.ai.ask({
        question: q,
        // Screen + transcript context are always used; the toggles were removed.
        useScreenContext: true,
        useTranscriptContext: true,
        sessionId: state.status?.activeSessionId
      })
      dispatch({ type: 'startMessage', id: requestId, question: q })
    } catch (err) {
      dispatch({ type: 'banner', banner: { kind: 'error', text: `Ask failed: ${String(err)}` } })
    }
  }

  return (
    <div className="panel">
      <div className="messages">
        {state.messages.length === 0 && (
          <p className="muted">
            Listening is on. Ask anything about what's on your screen or being said, and
            questions heard in the conversation are answered automatically.
          </p>
        )}
        {state.messages.map((m) => (
          <div key={m.id} className="msg">
            <div className="msg__q">{m.question}</div>
            <div className="msg__a">
              {m.answer ? <Markdown text={m.answer} /> : m.streaming ? <span className="muted">…</span> : null}
              {m.streaming && <span className="cursor">▍</span>}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="ask" {...interactiveProps()}>
        <div className="ask__row">
          <textarea
            ref={inputRef}
            className="ask__input"
            placeholder="Ask anything…  (Enter to send, Shift+Enter for a new line)"
            value={question}
            rows={1}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void ask()
              }
            }}
          />
          <button className="ask__btn" onClick={() => void ask()}>
            Ask
          </button>
        </div>
      </div>
    </div>
  )
}
