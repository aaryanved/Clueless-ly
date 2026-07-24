import { useEffect, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { useListening } from '../audio/use-listening'
import { interactiveProps } from '../interactivity'
import { AssistantPanel } from './AssistantPanel'
import { TranscriptPanel } from './TranscriptPanel'
import { SettingsDrawer } from './SettingsDrawer'

export function OverlayShell(): JSX.Element {
  const { state, dispatch } = useStore()
  const { transcribing, start } = useListening()
  const [showSettings, setShowSettings] = useState(false)
  const autoStarted = useRef(false)

  // Listening turns on automatically once settings have loaded — no button required.
  useEffect(() => {
    if (autoStarted.current) return
    if (!state.settings) return
    autoStarted.current = true
    void start().catch(() => {})
  }, [state.settings, start])

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__left">
          <span className="brand">
            <span className="brand__dot" data-ready={state.status?.ready ? 'yes' : 'no'} />
            Clueless-ly
          </span>
        </div>

        <div className="topbar__right">
          <span
            className="live-indicator"
            data-on={transcribing ? 'yes' : 'no'}
            title={transcribing ? 'Listening' : 'Not listening'}
          />
          <button
            className="icon-btn"
            title="Settings & sessions"
            onClick={() => setShowSettings(true)}
            {...interactiveProps()}
          >
            <GearIcon />
          </button>
        </div>
      </header>

      {state.banner && (
        <div
          className={`banner banner--${state.banner.kind}`}
          onClick={() => dispatch({ type: 'banner', banner: null })}
          {...interactiveProps()}
        >
          {state.banner.text}
        </div>
      )}

      <div className="workspace">
        <section className="workspace__main">
          <AssistantPanel />
        </section>
        <aside className="workspace__side">
          <TranscriptPanel />
        </aside>
      </div>

      {showSettings && <SettingsDrawer onClose={() => setShowSettings(false)} />}
    </div>
  )
}

function GearIcon(): JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
