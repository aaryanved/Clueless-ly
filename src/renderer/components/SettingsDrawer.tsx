import { useEffect, useState } from 'react'
import { SettingsPanel } from './SettingsPanel'
import { ContextPanel } from './ContextPanel'
import { ModesPanel } from './ModesPanel'
import { enterInteractive, leaveInteractive, interactiveProps } from '../interactivity'

type Tab = 'modes' | 'context' | 'settings'

/**
 * Slide-in drawer opened from the top-right gear icon. Tabs: Modes, Context, Settings.
 * While open, the overlay is fully interactive (it forces mouse capture on mount).
 */
export function SettingsDrawer({ onClose }: { onClose: () => void }): JSX.Element {
  const [tab, setTab] = useState<Tab>('modes')

  useEffect(() => {
    enterInteractive()
    return () => leaveInteractive()
  }, [])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'modes', label: 'Modes' },
    { id: 'context', label: 'Context' },
    { id: 'settings', label: 'Settings' }
  ]

  return (
    <div className="drawer-scrim" onClick={onClose} {...interactiveProps()}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer__head">
          <div className="drawer__switch">
            {tabs.map((t) => (
              <button
                key={t.id}
                className={tab === t.id ? 'seg-btn seg-btn--on' : 'seg-btn'}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button className="icon-btn" title="Close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="drawer__body">
          {tab === 'modes' && <ModesPanel />}
          {tab === 'context' && <ContextPanel />}
          {tab === 'settings' && <SettingsPanel />}
        </div>
      </div>
    </div>
  )
}
