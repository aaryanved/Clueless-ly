import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import type { SpeechContext } from '@shared/types'

const FILE_ACCEPT = '.pptx,.pdf,.txt,.md,.markdown'

function stamp(ts: number): string {
  const d = new Date(ts)
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

/**
 * Speech-mode context: the speech / presentation the audience Q&A is answered from.
 * Same submit-to-a-saved-chip flow as User Context. Used only while Speech mode is on.
 */
export function SpeechContextPanel(): JSX.Element {
  const [ctx, setCtx] = useState<SpeechContext>({ text: '' })
  const [draft, setDraft] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.clueless.context.getAll().then((d) => {
      setCtx(d.speech)
      setDraft(d.speech.text)
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
      setDraft((d) => (d ? `${d}\n\n----- ${file.name} -----\n${content}` : content))
      setNote(`Loaded ${file.name}`)
      setTimeout(() => setNote(null), 2000)
    } catch {
      setNote('Could not read that file.')
    }
  }

  async function submit(): Promise<void> {
    await window.clueless.context.setSpeech(draft, true).catch(() => {})
    setCtx({ text: draft, savedAt: Date.now() })
  }
  async function remove(): Promise<void> {
    await window.clueless.context.clearSpeech().catch(() => {})
    setCtx({ text: '' })
    setDraft('')
  }

  if (ctx.savedAt) {
    return (
      <div className="panel panel--scroll">
        <section className="group">
          <div className="ctx-chip">
            <span className="ctx-chip__label">Speech: {stamp(ctx.savedAt)}</span>
            <button className="ctx-chip__x" title="Delete" onClick={() => void remove()}>
              ✕
            </button>
          </div>
          <p className="muted small">
            Audience questions are answered from this while Speech mode is on. Delete to
            load a new one.
          </p>
        </section>
      </div>
    )
  }

  return (
    <div className="panel panel--scroll">
      <section className="group">
        <p className="muted small">
          Paste your speech or load a PowerPoint / PDF. Then answer audience questions
          grounded in what you presented.
        </p>
        <textarea
          className="context-input"
          placeholder="Paste your speech or talking points here…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="context-actions">
          <button className="btn btn--ghost" onClick={() => fileRef.current?.click()}>
            Load PPT / file
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
