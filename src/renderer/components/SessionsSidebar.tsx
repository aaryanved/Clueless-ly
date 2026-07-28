import { useMemo, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { interactiveProps } from '../interactivity'
import type { SessionSummary } from '@shared/types'

const DAY = 86_400_000

/** ChatGPT-style buckets, computed against local midnight rather than raw age. */
function bucketFor(ts: number): string {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const midnight = start.getTime()
  if (ts >= midnight) return 'Today'
  if (ts >= midnight - DAY) return 'Yesterday'
  if (ts >= midnight - 7 * DAY) return 'Previous 7 days'
  if (ts >= midnight - 30 * DAY) return 'Previous 30 days'
  return new Date(ts).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

function groupSessions(sessions: SessionSummary[]): Array<[string, SessionSummary[]]> {
  const groups = new Map<string, SessionSummary[]>()
  // `sessions` already arrives newest-first, so insertion order gives ordered buckets.
  for (const s of sessions) {
    const key = bucketFor(s.updatedAt)
    const bucket = groups.get(key)
    if (bucket) bucket.push(s)
    else groups.set(key, [s])
  }
  return [...groups.entries()]
}

/**
 * Saved-conversation history. Rows are grouped by recency, clicking one reopens it
 * (restoring its messages, transcript and the AI's short-term memory), and each row can
 * be renamed or deleted in place. Deletion asks for a second click rather than opening a
 * dialog, which would freeze the always-on-top overlay.
 */
export function SessionsSidebar(): JSX.Element {
  const { state, dispatch } = useStore()
  const [query, setQuery] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const confirmTimer = useRef<number | null>(null)

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matched = q
      ? state.sessions.filter((s) => s.title.toLowerCase().includes(q))
      : state.sessions
    return groupSessions(matched)
  }, [state.sessions, query])

  async function open(id: string): Promise<void> {
    if (id === state.activeSessionId) return
    try {
      const session = await window.clueless.sessions.activate(id)
      if (session) dispatch({ type: 'loadSession', session })
    } catch (err) {
      dispatch({ type: 'banner', banner: { kind: 'error', text: `Open session: ${String(err)}` } })
    }
  }

  async function newChat(): Promise<void> {
    try {
      await window.clueless.sessions.newConversation()
    } catch {
      /* non-fatal: the UI still resets below */
    }
    dispatch({ type: 'clearMessages' })
    dispatch({ type: 'clearTranscript' })
  }

  async function commitRename(id: string): Promise<void> {
    const title = draft.trim()
    setRenaming(null)
    if (!title) return
    await window.clueless.sessions.rename(id, title).catch(() => {})
  }

  async function remove(id: string): Promise<void> {
    if (confirmDelete !== id) {
      setConfirmDelete(id)
      if (confirmTimer.current) window.clearTimeout(confirmTimer.current)
      confirmTimer.current = window.setTimeout(() => setConfirmDelete(null), 3000)
      return
    }
    setConfirmDelete(null)
    const wasActive = id === state.activeSessionId
    await window.clueless.sessions.remove(id).catch(() => {})
    if (wasActive) {
      dispatch({ type: 'clearMessages' })
      dispatch({ type: 'clearTranscript' })
    }
  }

  return (
    <aside className="sidebar" {...interactiveProps()}>
      <div className="sidebar__head">
        <button className="sidebar__new" onClick={() => void newChat()}>
          <PencilIcon />
          New chat
        </button>
      </div>

      <div className="sidebar__search">
        <SearchIcon />
        <input
          className="sidebar__search-input"
          placeholder="Search chats"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="sidebar__list">
        {state.sessions.length === 0 && (
          <p className="muted small sidebar__empty">
            Your conversations are saved here automatically once you ask something.
          </p>
        )}
        {state.sessions.length > 0 && groups.length === 0 && (
          <p className="muted small sidebar__empty">No chats match "{query}".</p>
        )}

        {groups.map(([label, items]) => (
          <div className="sidebar__group" key={label}>
            <h4 className="sidebar__group-label">{label}</h4>
            {items.map((s) =>
              renaming === s.id ? (
                <input
                  key={s.id}
                  className="sidebar__rename"
                  value={draft}
                  autoFocus
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => void commitRename(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void commitRename(s.id)
                    if (e.key === 'Escape') setRenaming(null)
                  }}
                />
              ) : (
                <div
                  key={s.id}
                  className={s.id === state.activeSessionId ? 'sess sess--on' : 'sess'}
                >
                  <button
                    className="sess__open"
                    title={`${s.title}\n${s.messageCount} messages · ${s.segmentCount} transcript lines`}
                    onClick={() => void open(s.id)}
                    onDoubleClick={() => {
                      setDraft(s.title)
                      setRenaming(s.id)
                    }}
                  >
                    {s.title}
                  </button>
                  <div className="sess__actions">
                    <button
                      className="sess__act"
                      title="Rename"
                      onClick={() => {
                        setDraft(s.title)
                        setRenaming(s.id)
                      }}
                    >
                      <PencilIcon small />
                    </button>
                    <button
                      className={
                        confirmDelete === s.id ? 'sess__act sess__act--arm' : 'sess__act'
                      }
                      title={confirmDelete === s.id ? 'Click again to delete' : 'Delete'}
                      onClick={() => void remove(s.id)}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        ))}
      </div>
    </aside>
  )
}

function PencilIcon({ small = false }: { small?: boolean } = {}): JSX.Element {
  const size = small ? 13 : 15
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  )
}

function TrashIcon(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
    </svg>
  )
}

function SearchIcon(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.6-3.6" />
    </svg>
  )
}
