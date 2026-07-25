import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import type { UserContext } from '@shared/types'

const FILE_ACCEPT =
  '.pdf,.pptx,.txt,.md,.markdown,.json,.csv,.log,.js,.ts,.tsx,.jsx,.py,.java,.c,.cpp,.cs,.go,.rs,.rb,.php,.html,.css,.yml,.yaml,.xml'

function stamp(ts: number): string {
  const d = new Date(ts)
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

/**
 * Global user context: the single context used for every answer. The user fills it once
 * and hits Submit, which "saves" it as a chip (with date/time). Delete to add a new one.
 */
export function UserContextPanel(): JSX.Element {
  const [ctx, setCtx] = useState<UserContext>({ text: '' })
  const [draft, setDraft] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.clueless.context.getAll().then((d) => {
      setCtx(d.user)
      setDraft(d.user.text)
    }).catch(() => {})
  }, [])

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
      setNote(`Loaded ${file.name}`)
      setTimeout(() => setNote(null), 2000)
    } catch {
      setNote('Could not read that file.')
    }
  }

  async function submit(): Promise<void> {
    await window.clueless.context.setUser(draft, true).catch(() => {})
    setCtx({ text: draft, savedAt: Date.now() })
  }
  async function remove(): Promise<void> {
    await window.clueless.context.clearUser().catch(() => {})
    setCtx({ text: '' })
    setDraft('')
  }

  // Saved state: show the chip.
  if (ctx.savedAt) {
    return (
      <div className="panel panel--scroll">
        <section className="group">
          <h3>User context</h3>
          <div className="ctx-chip">
            <span className="ctx-chip__label">User Context: {stamp(ctx.savedAt)}</span>
            <button className="ctx-chip__x" title="Delete" onClick={() => void remove()}>
              ✕
            </button>
          </div>
          <p className="muted small">This context is used for every answer. Delete it to add a new one.</p>
        </section>
      </div>
    )
  }

  return (
    <div className="panel panel--scroll">
      <section className="group">
        <h3>User context</h3>
        <p className="muted small">
          Add anything the assistant should always know about you (a bio, a document, prep
          notes). Paste text or load a file, then Submit to save it.
        </p>
        <textarea
          className="context-input"
          placeholder="Paste reference text here…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="context-actions">
          <button className="btn btn--ghost" onClick={() => fileRef.current?.click()}>
            Load file
          </button>
          <span className="muted small">{draft.length.toLocaleString()} chars</span>
          <button className="btn ctx-submit" disabled={!draft.trim()} onClick={() => void submit()}>
            Submit
          </button>
        </div>
        {note && <p className="muted small">{note}</p>}
        <input ref={fileRef} type="file" accept={FILE_ACCEPT} style={{ display: 'none' }} onChange={(e) => void onFile(e)} />
      </section>
    </div>
  )
}
