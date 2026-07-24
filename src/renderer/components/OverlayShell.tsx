import { useStore, type TabId } from '../state/store'
import { AssistantPanel } from './AssistantPanel'
import { TranscriptPanel } from './TranscriptPanel'
import { SessionsPanel } from './SessionsPanel'
import { SettingsPanel } from './SettingsPanel'

const TABS: { id: TabId; label: string }[] = [
  { id: 'assistant', label: 'Assistant' },
  { id: 'transcript', label: 'Transcript' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'settings', label: 'Settings' }
]

export function OverlayShell(): JSX.Element {
  const { state, dispatch } = useStore()

  return (
    <div className="overlay">
      <header className="overlay__bar">
        <span className="overlay__title">Clueless-ly</span>
        <div className="overlay__status">
          {state.transcribing && <span className="live-dot" title="Listening" />}
          <span className="overlay__dot" data-ready={state.status?.ready ? 'yes' : 'no'} />
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={state.tab === t.id ? 'tab tab--active' : 'tab'}
            onClick={() => dispatch({ type: 'setTab', tab: t.id })}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {state.banner && (
        <div className={`banner banner--${state.banner.kind}`} onClick={() => dispatch({ type: 'banner', banner: null })}>
          {state.banner.text}
        </div>
      )}

      <main className="overlay__body">
        {state.tab === 'assistant' && <AssistantPanel />}
        {state.tab === 'transcript' && <TranscriptPanel />}
        {state.tab === 'sessions' && <SessionsPanel />}
        {state.tab === 'settings' && <SettingsPanel />}
      </main>
    </div>
  )
}
