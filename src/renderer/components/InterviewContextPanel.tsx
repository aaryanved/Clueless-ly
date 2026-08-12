import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import type { InterviewContext, ProfileSet } from '@shared/types'
import { ProfileContextField, type ProfileContextFieldHandle } from './ProfileContextField'

const DOC_ACCEPT = '.pdf,.docx,.txt,.md'
const PROJ_ACCEPT = '.zip,.pdf,.txt,.md,.js,.ts,.py,.java,.json'

const emptyProfileSet = (): ProfileSet => ({ profiles: [], activeId: null })

function stamp(ts: number): string {
  const d = new Date(ts)
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

/**
 * Interview-specific context, used when Interview mode is on: the job description, the
 * resume submitted for the role, and the projects (zip files or links) that back up the
 * technical answers.
 */
function emptyInterview(): InterviewContext {
  return {
    jobDescription: '',
    resume: '',
    projects: '',
    notes: emptyProfileSet(),
    coverLetter: emptyProfileSet()
  }
}

export function InterviewContextPanel(): JSX.Element {
  const [iv, setIv] = useState<InterviewContext>(emptyInterview())
  const [note, setNote] = useState<string | null>(null)
  const jobRef = useRef<HTMLInputElement>(null)
  const resumeRef = useRef<HTMLInputElement>(null)
  const projRef = useRef<HTMLInputElement>(null)
  const notesRef = useRef<ProfileContextFieldHandle>(null)
  const coverLetterRef = useRef<ProfileContextFieldHandle>(null)

  useEffect(() => {
    window.clueless.context.getAll().then((d) => setIv(d.interview)).catch(() => {})
  }, [])

  function update(patch: Partial<InterviewContext>): void {
    const next = { ...iv, ...patch }
    setIv(next)
    void window.clueless.context.setInterview(patch, false)
  }

  async function loadInto(
    field: 'jobDescription' | 'resume' | 'projects',
    e: ChangeEvent<HTMLInputElement>
  ): Promise<void> {
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
    // Only patch the plain-text fields this panel owns directly. notes/coverLetter are
    // ProfileSets owned by the child ProfileContextField and saved via their own IPC
    // calls below - sending the parent's (possibly stale) copy of them here would spread
    // over and clobber whatever those calls just wrote.
    await Promise.all([
      window.clueless.context
        .setInterview(
          { jobDescription: iv.jobDescription, resume: iv.resume, projects: iv.projects },
          true
        )
        .catch(() => {}),
      notesRef.current?.saveIfDirty(),
      coverLetterRef.current?.saveIfDirty()
    ])
    setIv((s) => ({ ...s, savedAt: Date.now() }))
    setNote('Saved interview context.')
    setTimeout(() => setNote(null), 2000)
  }
  async function clearAll(): Promise<void> {
    await window.clueless.context.clearInterview().catch(() => {})
    setIv(emptyInterview())
  }

  return (
    <div className="panel panel--scroll">
      <section className="group">
        <p className="muted small">
          Give the interview everything it needs to answer accurately: the role's job
          description, your submitted resume, the projects (as .zip or links) referenced in
          it, your general prep notes, and your cover letter. Used only while Interview mode
          is on.
        </p>

        <label className="ctx-field">
          <span className="ctx-field__label">Job description</span>
          <textarea
            className="context-input context-input--sm"
            placeholder="Paste the job posting / role description…"
            value={iv.jobDescription}
            onChange={(e) => update({ jobDescription: e.target.value })}
          />
          <button className="btn btn--ghost btn--sm" onClick={() => jobRef.current?.click()}>
            Load file
          </button>
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

        <ProfileContextField
          ref={notesRef}
          field="notes"
          label="Interview notes"
          description="General prep notes for this interview: talking points, questions to ask, things to remember. Save multiple versions and switch between them per interview."
          placeholder="Paste or write general notes for this interview…"
          fileAccept={DOC_ACCEPT}
          initial={iv.notes}
        />

        <ProfileContextField
          ref={coverLetterRef}
          field="coverLetter"
          label="Cover letter"
          description="The cover letter you submitted for this role. Save multiple versions and switch between them per interview."
          placeholder="Paste your cover letter, or load the file…"
          fileAccept={DOC_ACCEPT}
          initial={iv.coverLetter}
        />

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

        <input ref={jobRef} type="file" accept={DOC_ACCEPT} style={{ display: 'none' }} onChange={(e) => void loadInto('jobDescription', e)} />
        <input ref={resumeRef} type="file" accept={DOC_ACCEPT} style={{ display: 'none' }} onChange={(e) => void loadInto('resume', e)} />
        <input ref={projRef} type="file" accept={PROJ_ACCEPT} style={{ display: 'none' }} onChange={(e) => void loadInto('projects', e)} />
      </section>
    </div>
  )
}
