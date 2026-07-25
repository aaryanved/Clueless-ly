import { useEffect, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { useListening } from '../audio/use-listening'
import { interactiveProps, enterInteractive, leaveInteractive } from '../interactivity'
import { applyAppearance } from '../appearance'
import { AssistantPanel } from './AssistantPanel'
import { TranscriptPanel } from './TranscriptPanel'
import { SettingsDrawer } from './SettingsDrawer'
import { SpeechView } from './SpeechView'
import { CodePane } from './CodePane'

export function OverlayShell(): JSX.Element {
  const { state, dispatch } = useStore()
  const { start } = useListening()
  const [showSettings, setShowSettings] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)
  const autoStarted = useRef(false)

  const modes = state.settings?.modes
  const technical = !!modes?.coding && !!modes?.interview
  const speech = !!modes?.speech
  const coding = !!modes?.coding
  // The transcript panel is hidden by default in coding / technical / speech modes and
  // revealed via the header toggle. In normal mode it is always shown.
  const transcriptHidden = coding || technical || speech
  const transcriptVisible = !transcriptHidden || showTranscript

  // Listening turns on automatically once settings have loaded; no button required.
  useEffect(() => {
    if (autoStarted.current) return
    if (!state.settings) return
    autoStarted.current = true
    void start().catch(() => {})
  }, [state.settings, start])

  // Keep theme / opacity / click-through in sync with settings.
  useEffect(() => {
    if (state.settings) applyAppearance(state.settings)
  }, [state.settings])

  async function newConversation(): Promise<void> {
    try {
      await window.clueless.sessions.newConversation()
    } catch {
      /* non-fatal */
    }
    dispatch({ type: 'clearMessages' })
    dispatch({ type: 'clearTranscript' })
  }

  async function minimize(): Promise<void> {
    await window.clueless.overlay.setMinimized(true).catch(() => {})
    setMinimized(true)
  }
  async function restore(): Promise<void> {
    await window.clueless.overlay.setMinimized(false).catch(() => {})
    setMinimized(false)
  }

  if (minimized) return <Pill live={state.transcribing} onClick={() => void restore()} />

  return (
    <div className="app">
      <header className="topbar" {...interactiveProps()}>
        <div className="topbar__zone topbar__zone--left">
          <button className="icon-btn icon-btn--quit" title="Quit Clueless-ly" onClick={() => void window.clueless.quit()}>
            <CloseIcon />
          </button>
        </div>

        <button className="brand brand--btn" title="Minimize to pill" onClick={() => void minimize()}>
          <span className="brand__logo" data-ready={state.status?.ready ? 'yes' : 'no'}>¿?</span>
          <span className="brand__name">Clueless-ly</span>
          <span className="brand__by">by AVB</span>
        </button>

        <div className="topbar__zone topbar__zone--right">
          {transcriptHidden && (
            <button
              className={showTranscript ? 'icon-btn icon-btn--on' : 'icon-btn'}
              title={showTranscript ? 'Hide transcript' : 'Show transcript'}
              onClick={() => setShowTranscript((v) => !v)}
            >
              <TranscriptIcon />
            </button>
          )}
          <button className="icon-btn" title="New conversation" onClick={() => void newConversation()}>
            <PlusIcon />
          </button>
          <button className="icon-btn" title="Modes, context & settings" onClick={() => setShowSettings(true)}>
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
        {speech ? (
          <section className="workspace__main">
            <SpeechView />
          </section>
        ) : (
          <>
            {technical && (
              <aside className="workspace__code">
                <CodePane />
              </aside>
            )}
            <section className="workspace__main">
              <AssistantPanel
                narrationOnly={technical}
                placeholder={
                  technical
                    ? 'Ask for a solution — code goes left, walkthrough here…'
                    : undefined
                }
              />
            </section>
            {transcriptVisible && (
              <aside className="workspace__side">
                <TranscriptPanel />
              </aside>
            )}
          </>
        )}
      </div>

      {showSettings && <SettingsDrawer onClose={() => setShowSettings(false)} />}
    </div>
  )
}

function Pill({ live, onClick }: { live: boolean; onClick: () => void }): JSX.Element {
  // Force interactivity while minimized so a click always restores the window.
  useEffect(() => {
    enterInteractive()
    return () => leaveInteractive()
  }, [])
  return (
    <div className="pill" onClick={onClick} title="Click to expand" {...interactiveProps()}>
      <span className="pill__dot" data-on={live ? 'yes' : 'no'} />
      <span className="pill__label">Clueless-ly</span>
    </div>
  )
}

function PlusIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function CloseIcon(): JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

function TranscriptIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M4 7h16M4 12h10M4 17h13" />
    </svg>
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
