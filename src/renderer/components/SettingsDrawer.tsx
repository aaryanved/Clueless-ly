import { useEffect, useState } from 'react'
import { SettingsPanel } from './SettingsPanel'
import { UserContextPanel } from './UserContextPanel'
import { InterviewContextPanel } from './InterviewContextPanel'
import { ModesPanel } from './ModesPanel'
import { enterInteractive, leaveInteractive, interactiveProps } from '../interactivity'
import type { AppModes } from '@shared/types'

type Tab = 'modes' | 'user' | 'settings'
type View = { kind: 'tab'; tab: Tab } | { kind: 'ctx'; mode: keyof AppModes }

const TABS: { id: Tab; label: string }[] = [
  { id: 'modes', label: 'Modes' },
  { id: 'user', label: 'User Context' },
  { id: 'settings', label: 'Settings' }
]

const CTX_TITLE: Record<string, string> = { interview: 'Interview Context' }

/**
 * Slide-in drawer. Top-level tabs: Modes, User Context, Settings. A mode's chevron drills
 * into that mode's context sub-view (e.g. Interview Context) with a back button.
 */
export function SettingsDrawer({ onClose }: { onClose: () => void }): JSX.Element {
  const [view, setView] = useState<View>({ kind: 'tab', tab: 'modes' })

  useEffect(() => {
    enterInteractive()
    return () => leaveInteractive()
  }, [])

  return (
    <div className="drawer-scrim" onClick={onClose} {...interactiveProps()}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer__head">
          {view.kind === 'ctx' ? (
            <button className="drawer__back" onClick={() => setView({ kind: 'tab', tab: 'modes' })}>
              ‹ {CTX_TITLE[view.mode] ?? 'Context'}
            </button>
          ) : (
            <div className="drawer__switch">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  className={view.tab === t.id ? 'seg-btn seg-btn--on' : 'seg-btn'}
                  onClick={() => setView({ kind: 'tab', tab: t.id })}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
          <button className="icon-btn" title="Close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="drawer__body">
          {view.kind === 'ctx' && view.mode === 'interview' && <InterviewContextPanel />}
          {view.kind === 'tab' && view.tab === 'modes' && (
            <ModesPanel onOpenContext={(mode) => setView({ kind: 'ctx', mode })} />
          )}
          {view.kind === 'tab' && view.tab === 'user' && <UserContextPanel />}
          {view.kind === 'tab' && view.tab === 'settings' && <SettingsPanel />}
        </div>
      </div>
    </div>
  )
}
