import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { AssistantPanel } from './AssistantPanel'
import { interactiveProps } from '../interactivity'

const FILE_ACCEPT = '.pptx,.pdf,.txt,.md,.markdown'

/**
 * Speech mode: the user enters or loads their speech / presentation, then hits
 * "Questions" to answer audience questions grounded in it. The speech is stored as the
 * assistant's reference material, so answers stay in line with what was presented.
 */
export function SpeechView(): JSX.Element {
  const [speech, setSpeech] = useState('')
  const [qa, setQa] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.clueless.context.getDocument().then(setSpeech).catch(() => {})
  }, [])

  function save(next: string): void {
    setSpeech(next)
    void window.clueless.context.setDocument(next)
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setNote(`Reading ${file.name}…`)
    try {
      const bytes = await file.arrayBuffer()
      const content = (await window.clueless.context.parseFile(file.name, bytes)).trim()
      if (!content) {
        setNote(`No readable text found in ${file.name}.`)
        return
      }
      save(content)
      setNote(`Loaded ${file.name}`)
      setTimeout(() => setNote(null), 2000)
    } catch {
      setNote('Could not read that file.')
    }
  }

  if (qa) {
    return (
      <div className="speech-qa">
        <div className="speech-qa__bar" {...interactiveProps()}>
          <span className="transcript-col__title">Q&amp;A — answering from your speech</span>
          <button className="link-btn" onClick={() => setQa(false)}>
            Edit speech
          </button>
        </div>
        <AssistantPanel placeholder="Type an audience question, or let it auto-answer spoken ones…" />
      </div>
    )
  }

  return (
    <div className="speech-setup" {...interactiveProps()}>
      <div className="speech-setup__inner">
        <h2 className="speech-setup__title">Your speech / presentation</h2>
        <p className="muted small">
          Paste your speech or load a PowerPoint / PDF. When you're done presenting, hit
          Questions and answer the audience grounded in what you presented.
        </p>
        <textarea
          className="speech-input"
          placeholder="Paste your speech or talking points here…"
          value={speech}
          onChange={(e) => save(e.target.value)}
        />
        <div className="speech-actions">
          <button className="btn btn--ghost" onClick={() => fileRef.current?.click()}>
            Load PPT / file
          </button>
          <button className="btn btn--ghost" onClick={() => save('')} disabled={!speech}>
            Clear
          </button>
          <span className="muted small">{speech.length.toLocaleString()} chars</span>
          <button className="btn speech-actions__go" disabled={!speech.trim()} onClick={() => setQa(true)}>
            Questions →
          </button>
        </div>
        {note && <p className="muted small">{note}</p>}
        <input ref={fileRef} type="file" accept={FILE_ACCEPT} style={{ display: 'none' }} onChange={(e) => void onFile(e)} />
      </div>
    </div>
  )
}
