// Helpers to separate fenced code blocks from prose, used by the technical-interview
// split view (code on the left, spoken walkthrough in the centre).

export interface CodeBlock {
  lang: string
  code: string
}

export function extractCodeBlocks(text: string): CodeBlock[] {
  const blocks: CodeBlock[] = []
  const re = /```(\w*)\n?([\s\S]*?)```/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    blocks.push({ lang: m[1] || 'code', code: m[2].replace(/\s+$/, '') })
  }
  return blocks
}

/** The answer text with fenced code blocks removed (leaving the narration/prose). */
export function stripCodeBlocks(text: string): string {
  return text.replace(/```\w*\n?[\s\S]*?```/g, '').replace(/\n{3,}/g, '\n\n').trim()
}
