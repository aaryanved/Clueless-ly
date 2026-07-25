import { useState } from 'react'
import { useStore } from '../state/store'
import { interactiveProps } from '../interactivity'
import { extractCodeBlocks } from './markdown-utils'

/**
 * Left-hand code column for technical-interview mode: shows the code from the most
 * recent answer while the centre column narrates how to explain it.
 */
export function CodePane(): JSX.Element {
  const { state } = useStore()
  const last = [...state.messages].reverse().find((m) => extractCodeBlocks(m.answer).length > 0)
  const blocks = last ? extractCodeBlocks(last.answer) : []

  return (
    <div className="codepane" {...interactiveProps()}>
      <div className="codepane__head">
        <span className="transcript-col__title">Code</span>
      </div>
      <div className="codepane__body">
        {blocks.length === 0 ? (
          <p className="muted small">The solution's code will appear here.</p>
        ) : (
          blocks.map((b, i) => <CodeCard key={i} lang={b.lang} code={b.code} />)
        )}
      </div>
    </div>
  )
}

function CodeCard({ lang, code }: { lang: string; code: string }): JSX.Element {
  const [copied, setCopied] = useState(false)
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      /* denied */
    }
  }
  return (
    <div className="code">
      <div className="code__head">
        <span className="code__lang">{lang}</span>
        <button className="code__copy" onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="code__body">
        <code>{code}</code>
      </pre>
    </div>
  )
}
