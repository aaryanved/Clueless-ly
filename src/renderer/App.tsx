import { useEffect, useState } from 'react'
import type { AppStatus } from '@shared/types'

// Batch 1 shell: proves the main <-> preload <-> renderer bridge works. Batch 2
// replaces this with the full overlay UI and a proper state store.
export function App(): JSX.Element {
  const [status, setStatus] = useState<AppStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.clueless
      .getStatus()
      .then(setStatus)
      .catch((e: unknown) => setError(String(e)))
  }, [])

  return (
    <div className="overlay">
      <header className="overlay__bar">
        <span className="overlay__title">Clueless-ly</span>
        <span className="overlay__dot" data-ready={status?.ready ? 'yes' : 'no'} />
      </header>
      <main className="overlay__body">
        {error && <p className="overlay__error">{error}</p>}
        {!status && !error && <p>Starting…</p>}
        {status && (
          <dl className="kv">
            <dt>Platform</dt>
            <dd>{status.platform.displayName}</dd>
            <dt>OS</dt>
            <dd>{status.platform.osVersion}</dd>
            <dt>Content protection</dt>
            <dd>{status.platform.contentProtection.supported ? 'Supported' : 'No'}</dd>
            <dt>System audio</dt>
            <dd>{status.platform.systemAudio.supported ? status.platform.systemAudio.method : 'No'}</dd>
          </dl>
        )}
      </main>
    </div>
  )
}
