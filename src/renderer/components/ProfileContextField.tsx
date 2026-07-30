import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import type { ProfileSet } from '@shared/types'

function stamp(ts: number): string {
  const d = new Date(ts)
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

interface Props {
  field: 'notes' | 'coverLetter'
  label: string
  description: string
  placeholder: string
  fileAccept: string
  initial: ProfileSet
}

/**
 * A context field that, unlike the single-value fields elsewhere in this panel, keeps
 * several named saved versions (e.g. one per company) and lets you switch which one is
 * active. Used for interview notes and cover letters.
 */
export function ProfileContextField({
  field,
  label,
  description,
  placeholder,
  fileAccept,
  initial
}: Props): JSX.Element {
  const [set, setSet] = useState<ProfileSet>(initial)
  const [draft, setDraft] = useState(initial.profiles.find((p) => p.id === initial.activeId)?.text ?? '')
  const [name, setName] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setSet(initial)
    setDraft(initial.profiles.find((p) => p.id === initial.activeId)?.text ?? '')
    // Only re-sync from the parent's initial fetch, not on every local edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial])

  const active = set.profiles.find((p) => p.id === set.activeId) ?? null

  function flash(msg: string): void {
    setNote(msg)
    setTimeout(() => setNote(null), 1800)
  }

  async function saveActive(): Promise<void> {
    if (active) {
      const next = await window.clueless.context.updateInterviewProfile(field, active.id, draft)
      setSet(next)
      flash('Updated.')
    } else {
      const next = await window.clueless.context.saveInterviewProfile(
        field,
        name.trim() || 'Untitled',
        draft
      )
      setSet(next)
      setName('')
      flash('Saved.')
    }
  }

  async function saveAsNew(): Promise<void> {
    const next = await window.clueless.context.saveInterviewProfile(
      field,
      name.trim() || `Version ${set.profiles.length + 1}`,
      draft
    )
    setSet(next)
    setName('')
    flash('Saved as a new version.')
  }

  async function switchTo(id: string): Promise<void> {
    const next = await window.clueless.context.switchInterviewProfile(field, id)
    setSet(next)
    setDraft(next.profiles.find((p) => p.id === id)?.text ?? '')
  }

  async function remove(id: string): Promise<void> {
    const next = await window.clueless.context.deleteInterviewProfile(field, id)
    setSet(next)
    setDraft(next.profiles.find((p) => p.id === next.activeId)?.text ?? '')
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setNote(`Reading ${file.name}…`)
    try {
      const bytes = await file.arrayBuffer()
      const content = (await window.clueless.context.parseFile(file.name, bytes)).trim()
      if (!content) return setNote(`No readable text in ${file.name}.`)
      setDraft((d) => (d ? `${d}\n\n----- ${file.name} -----\n${content}` : `----- ${file.name} -----\n${content}`))
      flash(`Loaded ${file.name}`)
    } catch {
      setNote('Could not read that file.')
    }
  }

  return (
    <label className="ctx-field">
      <span className="ctx-field__label">{label}</span>
      <p className="muted small">{description}</p>

      {set.profiles.length > 0 && (
        <div className="ctx-profile-row">
          <select
            className="ctx-profile-select"
            value={set.activeId ?? ''}
            onChange={(e) => void switchTo(e.target.value)}
          >
            <option value="" disabled>
              Select a saved version…
            </option>
            {set.profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {stamp(p.savedAt)}
              </option>
            ))}
          </select>
          {active && (
            <button
              className="ctx-chip__x"
              title="Delete this version"
              type="button"
              onClick={() => void remove(active.id)}
            >
              ✕
            </button>
          )}
        </div>
      )}

      <textarea
        className="context-input context-input--sm"
        placeholder={placeholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />

      <div className="context-actions">
        <button className="btn btn--ghost btn--sm" type="button" onClick={() => fileRef.current?.click()}>
          Load file
        </button>
        <input
          className="ctx-name-input"
          type="text"
          placeholder="Version name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn btn--ghost" type="button" onClick={() => void saveAsNew()}>
          Save as new
        </button>
        <button
          className="btn ctx-submit"
          type="button"
          disabled={!draft.trim()}
          onClick={() => void saveActive()}
        >
          {active ? 'Update saved' : 'Save'}
        </button>
      </div>
      {note && <p className="muted small">{note}</p>}
      <input
        ref={fileRef}
        type="file"
        accept={fileAccept}
        style={{ display: 'none' }}
        onChange={(e) => void onFile(e)}
      />
    </label>
  )
}
