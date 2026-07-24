import { useState } from 'react'
import { useStore } from '../state/store'

export function AssistantPanel(): JSX.Element {
  const { state, dispatch } = useStore()
  const [question, setQuestion] = useState('')
  const [useScreen, setUseScreen] = useState(true)
  const [useTranscript, setUseTranscript] = useState(true)

  async function ask(): Promise<void> {
    const q = question.trim()
    if (!q) return
    setQuestion('')
    try {
      const { requestId } = await window.clueless.ai.ask({
        question: q,
        useScreenContext: useScreen,
        useTranscriptContext: useTranscript,
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
            Ask a question about what's on your screen or being said. Answers stream in here.
          </p>
        )}
        {state.messages.map((m) => (
          <div key={m.id} className="msg">
            <div className="msg__q">{m.question}</div>
            <div className="msg__a">
              {m.answer || (m.streaming ? '…' : '')}
              {m.streaming && <span className="cursor">▍</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="ask">
        <div className="ask__toggles">
          <label>
            <input type="checkbox" checked={useScreen} onChange={(e) => setUseScreen(e.target.checked)} />
            Screen
          </label>
          <label>
            <input
              type="checkbox"
              checked={useTranscript}
              onChange={(e) => setUseTranscript(e.target.checked)}
            />
            Transcript
          </label>
        </div>
        <div className="ask__row">
          <textarea
            className="ask__input"
            placeholder="Ask anything…"
            value={question}
            rows={2}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void ask()
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
