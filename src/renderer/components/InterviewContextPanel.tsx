import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import type { InterviewContext } from '@shared/types'

const DOC_ACCEPT = '.pdf,.docx,.txt,.md'
const PROJ_ACCEPT = '.zip,.pdf,.txt,.md,.js,.ts,.py,.java,.json'

function stamp(ts: number): string {
  const d = new Date(ts)
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

/**
 * Interview-specific context, used when Interview mode is on: the job description, the
 * resume submitted for the role, and the projects (zip files or links) that back up the
 * technical answers.
 */
export function InterviewContextPanel(): JSX.Element {
  const [iv, setIv] = useState<InterviewContext>({ jobDescription: '', resume: '', projects: '' })
  const [note, setNote] = useState<string | null>(null)
  const resumeRef = useRef<HTMLInputElement>(null)
  const projRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.clueless.context.getAll().then((d) => setIv(d.interview)).catch(() => {})
  }, [])

  function update(patch: Partial<InterviewContext>): void {
    const next = { ...iv, ...patch }
    setIv(next)
    void window.clueless.context.setInterview(patch, false)
  }

  async function loadInto(field: 'resume' | 'projects', e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setNote(`Reading ${file.name}…`)
    try {
      const bytes = await file.arrayBuffer()
      const content = (await window.clueless.context.parseFile(file.name, bytes)).trim()
      if (!content) return setNote(`No readable text in ${file.name}.`)
      const prev = iv[field]
      const merged = prev ? `${prev}\n\n----- ${file.name} -----\n${content}` : `----- ${file.name} -----\n${content}`
      update({ [field]: merged } as Partial<InterviewContext>)
      setNote(`Loaded ${file.name}`)
      setTimeout(() => setNote(null), 2000)
    } catch {
      setNote('Could not read that file.')
    }
  }

  async function submit(): Promise<void> {
    await window.clueless.context.setInterview(iv, true).catch(() => {})
    setIv((s) => ({ ...s, savedAt: Date.now() }))
    setNote('Saved interview context.')
    setTimeout(() => setNote(null), 2000)
  }
  async function clearAll(): Promise<void> {
    await window.clueless.context.clearInterview().catch(() => {})
    setIv({ jobDescription: '', resume: '', projects: '' })
  }

  return (
    <div className="panel panel--scroll">
      <section className="group">
        <p className="muted small">
          Give the interview everything it needs to answer accurately: the role's job
          description, your submitted resume, and the projects (as .zip or links) referenced
          in it. Used only while Interview mode is on.
        </p>

        <label className="ctx-field">
          <span className="ctx-field__label">Job description</span>
          <textarea
            className="context-input context-input--sm"
            placeholder="Paste the job posting / role description…"
            value={iv.jobDescription}
            onChange={(e) => update({ jobDescription: e.target.value })}
          />
        </label>

        <label className="ctx-field">
          <span className="ctx-field__label">Resume (as submitted)</span>
          <textarea
            className="context-input context-input--sm"
            placeholder="Paste your resume, or load the file…"
            value={iv.resume}
            onChange={(e) => update({ resume: e.target.value })}
          />
          <button className="btn btn--ghost btn--sm" onClick={() => resumeRef.current?.click()}>
            Load resume file
          </button>
        </label>

        <label className="ctx-field">
          <span className="ctx-field__label">Projects &amp; links</span>
          <textarea
            className="context-input context-input--sm"
            placeholder="Paste project links, notes, or load a project .zip to extract its text…"
            value={iv.projects}
            onChange={(e) => update({ projects: e.target.value })}
          />
          <button className="btn btn--ghost btn--sm" onClick={() => projRef.current?.click()}>
            Load project zip / file
          </button>
        </label>

        <div className="context-actions">
          <button className="btn btn--ghost" onClick={() => void clearAll()}>
            Clear
          </button>
          {iv.savedAt && <span className="muted small">Saved {stamp(iv.savedAt)}</span>}
          <button className="btn ctx-submit" onClick={() => void submit()}>
            Save
          </button>
        </div>
        {note && <p className="muted small">{note}</p>}

        <input ref={resumeRef} type="file" accept={DOC_ACCEPT} style={{ display: 'none' }} onChange={(e) => void loadInto('resume', e)} />
        <input ref={projRef} type="file" accept={PROJ_ACCEPT} style={{ display: 'none' }} onChange={(e) => void loadInto('projects', e)} />
      </section>
    </div>
  )
}
