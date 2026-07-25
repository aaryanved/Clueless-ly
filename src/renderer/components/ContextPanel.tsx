import { useEffect, useRef, useState, type ChangeEvent } from 'react'

// Lets the user paste text or load a text-based document that grounds answers for the
// session (included as reference material in every question until cleared).
const FILE_ACCEPT =
  '.pdf,.txt,.md,.markdown,.json,.csv,.log,.js,.ts,.tsx,.jsx,.py,.java,.c,.cpp,.cs,.go,.rs,.rb,.php,.html,.css,.yml,.yaml,.xml'

export function ContextPanel(): JSX.Element {
  const [text, setText] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.clueless.context.getDocument().then(setText).catch(() => {})
  }, [])

  function save(next: string): void {
    setText(next)
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
      const merged = text ? `${text}\n\n----- ${file.name} -----\n${content}` : `----- ${file.name} -----\n${content}`
      save(merged)
      setNote(`Loaded ${file.name}`)
      setTimeout(() => setNote(null), 2000)
    } catch {
      setNote('Could not read that file.')
    }
  }

  return (
    <div className="panel panel--scroll">
      <section className="group">
        <h3>Session context</h3>
        <p className="muted small">
          Paste text or load a document (PDF or text files). The assistant uses it as
          reference for every answer until you clear it.
        </p>
        <textarea
          className="context-input"
          placeholder="Paste reference text here (notes, a spec, a transcript, code)…"
          value={text}
          onChange={(e) => save(e.target.value)}
        />
        <div className="context-actions">
          <button className="btn btn--ghost" onClick={() => fileRef.current?.click()}>
            Load file
          </button>
          <button className="btn btn--ghost" onClick={() => save('')} disabled={!text}>
            Clear
          </button>
          <span className="muted small">{text.length.toLocaleString()} chars</span>
        </div>
        {note && <p className="muted small">{note}</p>}
        <input
          ref={fileRef}
          type="file"
          accept={FILE_ACCEPT}
          style={{ display: 'none' }}
          onChange={(e) => void onFile(e)}
        />
      </section>
    </div>
  )
}
