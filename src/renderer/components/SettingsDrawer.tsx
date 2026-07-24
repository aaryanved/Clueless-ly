import { useEffect, useState } from 'react'
import { SettingsPanel } from './SettingsPanel'
import { SessionsPanel } from './SessionsPanel'
import { enterInteractive, leaveInteractive } from '../interactivity'

/**
 * Slide-in drawer opened from the top-right gear icon. Holds settings, session history
 * and the Quit action. While open, the overlay is fully interactive (it forces mouse
 * capture on mount so clicks work even if the pointer was already inside).
 */
export function SettingsDrawer({ onClose }: { onClose: () => void }): JSX.Element {
  const [tab, setTab] = useState<'settings' | 'sessions'>('settings')

  useEffect(() => {
    enterInteractive()
    return () => leaveInteractive()
  }, [])

  return (
    <div className="drawer-scrim" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer__head">
          <div className="drawer__switch">
            <button
              className={tab === 'settings' ? 'seg-btn seg-btn--on' : 'seg-btn'}
              onClick={() => setTab('settings')}
            >
              Settings
            </button>
            <button
              className={tab === 'sessions' ? 'seg-btn seg-btn--on' : 'seg-btn'}
              onClick={() => setTab('sessions')}
            >
              Sessions
            </button>
          </div>
          <button className="icon-btn" title="Close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="drawer__body">
          {tab === 'settings' ? <SettingsPanel /> : <SessionsPanel />}
        </div>

        <div className="drawer__foot">
          <button className="btn btn--danger" onClick={() => void window.clueless.quit()}>
            Quit Clueless-ly
          </button>
        </div>
      </div>
    </div>
  )
}
