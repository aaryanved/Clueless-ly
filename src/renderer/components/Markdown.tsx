import { useState, type ReactNode } from 'react'
import { interactiveProps } from '../interactivity'

// Lightweight Markdown rendering for AI answers: fenced code blocks (with copy),
// headings (#..######), bullet/numbered lists, **bold**, `inline code`, and a
// best-effort LaTeX-to-readable pass. Dependency-free and streaming-friendly (an
// unclosed ``` renders as an open code block).

interface CodeBlockT {
  type: 'code'
  lang?: string
  content: string
}
interface TextBlockT {
  type: 'text'
  content: string
}
type Block = CodeBlockT | TextBlockT

function splitCode(src: string): Block[] {
  const blocks: Block[] = []
  const lines = src.split('\n')
  let inCode = false
  let lang = ''
  let buf: string[] = []
  const flush = (type: 'text' | 'code'): void => {
    if (type === 'code') blocks.push({ type: 'code', lang, content: buf.join('\n') })
    else if (buf.length) blocks.push({ type: 'text', content: buf.join('\n') })
    buf = []
  }
  for (const line of lines) {
    const fence = line.match(/^```(\w*)\s*$/)
    if (fence) {
      if (!inCode) {
        flush('text')
        inCode = true
        lang = fence[1] || ''
      } else {
        flush('code')
        inCode = false
        lang = ''
      }
      continue
    }
    buf.push(line)
  }
  flush(inCode ? 'code' : 'text')
  return blocks
}

// --- LaTeX -> readable text -------------------------------------------------------
const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', n: 'ⁿ', i: 'ⁱ' }
const SUB: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', i: 'ᵢ', j: 'ⱼ', n: 'ₙ' }

function toScript(s: string, map: Record<string, string>): string | null {
  let out = ''
  for (const ch of s) {
    if (map[ch]) out += map[ch]
    else return null
  }
  return out
}

function cleanMathSegment(m: string): string {
  let s = m
  s = s.replace(/\\text\{([^}]*)\}/g, '$1')
  s = s.replace(/\\mathrm\{([^}]*)\}/g, '$1')
  s = s.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)')
  s = s.replace(/\\sqrt\{([^}]*)\}/g, '√($1)')
  // superscripts / subscripts
  s = s.replace(/\^\{([^}]+)\}|\^(\w)/g, (_, a, b) => {
    const t = a ?? b
    return toScript(t, SUP) ?? `^${t}`
  })
  s = s.replace(/_\{([^}]+)\}|_(\w)/g, (_, a, b) => {
    const t = a ?? b
    return toScript(t, SUB) ?? `_${t}`
  })
  const words: Record<string, string> = {
    log: 'log', ln: 'ln', min: 'min', max: 'max', sin: 'sin', cos: 'cos', tan: 'tan', lim: 'lim', sum: 'Σ', prod: 'Π', int: '∫'
  }
  s = s.replace(/\\(log|ln|min|max|sin|cos|tan|lim|sum|prod|int)\b/g, (_, w) => words[w])
  const symbols: Record<string, string> = {
    times: '×', cdot: '·', div: '÷', pm: '±', mp: '∓', leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠',
    approx: '≈', equiv: '≡', infty: '∞', partial: '∂', nabla: '∇', forall: '∀', exists: '∃', in: '∈', notin: '∉',
    subset: '⊂', supset: '⊃', cup: '∪', cap: '∩', rightarrow: '→', leftarrow: '←', Rightarrow: '⇒', to: '→',
    alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', theta: 'θ', lambda: 'λ', mu: 'μ', pi: 'π',
    sigma: 'σ', phi: 'φ', omega: 'ω', Delta: 'Δ', Sigma: 'Σ', Omega: 'Ω', Pi: 'Π', ldots: '…', cdots: '⋯'
  }
  s = s.replace(/\\([A-Za-z]+)/g, (_all, w) => symbols[w] ?? w)
  s = s.replace(/[{}]/g, '')
  return s.trim()
}

/** Replace $...$, \(...\), \[...\] math spans with readable text. */
function cleanMath(text: string): string {
  let s = text
  s = s.replace(/\\\((.+?)\\\)/gs, (_, m) => cleanMathSegment(m))
  s = s.replace(/\\\[(.+?)\\\]/gs, (_, m) => cleanMathSegment(m))
  s = s.replace(/\$\$(.+?)\$\$/gs, (_, m) => cleanMathSegment(m))
  s = s.replace(/(?<!\\)\$(?!\s)(.+?)(?<!\s)\$/g, (_, m) => cleanMathSegment(m))
  return s
}

// --- inline (bold + inline code) --------------------------------------------------
function renderInline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    const tok = m[0]
    if (tok.startsWith('**')) nodes.push(<strong key={`${keyBase}-b${i}`}>{tok.slice(2, -2)}</strong>)
    else nodes.push(<code key={`${keyBase}-c${i}`} className="inline-code">{tok.slice(1, -1)}</code>)
    last = m.index + tok.length
    i++
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

// --- text block -> headings / lists / paragraphs ----------------------------------
function renderTextBlock(raw: string, key: string): ReactNode {
  const text = cleanMath(raw)
  const lines = text.split('\n')
  const out: ReactNode[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  let para: string[] = []

  const flushPara = (): void => {
    if (!para.length) return
    out.push(
      <p key={`${key}-p${out.length}`} className="md__p">
        {renderInline(para.join('\n'), `${key}-p${out.length}`)}
      </p>
    )
    para = []
  }
  const flushList = (): void => {
    if (!list) return
    const items = list.items
    const Tag = list.ordered ? 'ol' : 'ul'
    out.push(
      <Tag key={`${key}-l${out.length}`} className="md__list">
        {items.map((it, idx) => (
          <li key={idx}>{renderInline(it, `${key}-l${out.length}-${idx}`)}</li>
        ))}
      </Tag>
    )
    list = null
  }

  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    const bullet = line.match(/^\s*[-*]\s+(.*)$/)
    const numbered = line.match(/^\s*\d+\.\s+(.*)$/)
    if (heading) {
      flushPara()
      flushList()
      const level = Math.min(6, heading[1].length)
      const Tag = (`h${Math.min(4, level)}`) as 'h1' | 'h2' | 'h3' | 'h4'
      out.push(
        <Tag key={`${key}-h${out.length}`} className={`md__h md__h${Math.min(4, level)}`}>
          {renderInline(heading[2], `${key}-h${out.length}`)}
        </Tag>
      )
    } else if (bullet || numbered) {
      flushPara()
      const ordered = !!numbered
      const item = (bullet ? bullet[1] : numbered![1])
      if (!list || list.ordered !== ordered) {
        flushList()
        list = { ordered, items: [] }
      }
      list.items.push(item)
    } else if (line.trim() === '') {
      flushPara()
      flushList()
    } else {
      flushList()
      para.push(line)
    }
  }
  flushPara()
  flushList()
  return <div key={key}>{out}</div>
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
  const blocks = splitCode(text)
  return (
    <div className="md">
      {blocks.map((b, i) =>
        b.type === 'code' ? <CodeBlock key={i} lang={b.lang} code={b.content} /> : renderTextBlock(b.content, `t${i}`)
      )}
    </div>
  )
}
