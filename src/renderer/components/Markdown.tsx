import { useState, type ReactNode } from 'react'
import { interactiveProps } from '../interactivity'

// Lightweight Markdown rendering for AI answers: fenced code blocks (with a copy
// button), **bold**, `inline code`, and preserved line breaks. Kept dependency-free
// and streaming-friendly (an unclosed ``` renders as an open code block).

interface Block {
  type: 'text' | 'code'
  lang?: string
  content: string
}

function parseBlocks(src: string): Block[] {
  const blocks: Block[] = []
  const lines = src.split('\n')
  let inCode = false
  let lang = ''
  let buf: string[] = []

  const flushText = (): void => {
    if (buf.length) blocks.push({ type: 'text', content: buf.join('\n') })
    buf = []
  }
  const flushCode = (): void => {
    blocks.push({ type: 'code', lang, content: buf.join('\n') })
    buf = []
    lang = ''
  }

  for (const line of lines) {
    const fence = line.match(/^```(\w*)\s*$/)
    if (fence) {
      if (!inCode) {
        flushText()
        inCode = true
        lang = fence[1] || ''
      } else {
        flushCode()
        inCode = false
      }
      continue
    }
    buf.push(line)
  }
  // Trailing buffer: an unterminated code fence (still streaming) or plain text.
  if (inCode) flushCode()
  else flushText()
  return blocks
}

function renderInline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    const tok = m[0]
    if (tok.startsWith('**')) {
      nodes.push(<strong key={`${keyBase}-b${i}`}>{tok.slice(2, -2)}</strong>)
    } else {
      nodes.push(<code key={`${keyBase}-c${i}`} className="inline-code">{tok.slice(1, -1)}</code>)
    }
    last = m.index + tok.length
    i++
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

function CodeBlock({ lang, code }: { lang?: string; code: string }): JSX.Element {
  const [copied, setCopied] = useState(false)
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      /* clipboard denied */
    }
  }
  return (
    <div className="code">
      <div className="code__head" {...interactiveProps()}>
        <span className="code__lang">{lang || 'code'}</span>
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

export function Markdown({ text }: { text: string }): JSX.Element {
  const blocks = parseBlocks(text)
  return (
    <div className="md">
      {blocks.map((b, i) =>
        b.type === 'code' ? (
          <CodeBlock key={i} lang={b.lang} code={b.content} />
        ) : (
          <p key={i} className="md__p">
            {renderInline(b.content, `p${i}`)}
          </p>
        )
      )}
    </div>
  )
}
