import { useStore } from '../state/store'

function fmt(ts: number): string {
  return new Date(ts).toLocaleString()
}

export function SessionsPanel(): JSX.Element {
  const { state, dispatch } = useStore()

  async function refresh(): Promise<void> {
    try {
      const list = await window.clueless.sessions.list()
      dispatch({ type: 'setSessions', sessions: list })
    } catch (err) {
      dispatch({ type: 'banner', banner: { kind: 'error', text: `Sessions: ${String(err)}` } })
    }
  }

  async function create(): Promise<void> {
    try {
      await window.clueless.sessions.create()
      await refresh()
    } catch (err) {
      dispatch({ type: 'banner', banner: { kind: 'error', text: `New session: ${String(err)}` } })
    }
  }

  return (
    <div className="panel">
      <div className="panel__actions">
        <button className="btn" onClick={() => void create()}>
          New session
        </button>
        <button className="btn btn--ghost" onClick={() => void refresh()}>
          Refresh
        </button>
      </div>
      <div className="sessions">
        {state.sessions.length === 0 && <p className="muted">No saved sessions yet.</p>}
        {state.sessions.map((s) => (
          <div key={s.id} className="session">
            <div className="session__title">{s.title}</div>
            <div className="session__meta">
              {fmt(s.startedAt)} · {s.segmentCount} segments · {s.noteCount} notes
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
