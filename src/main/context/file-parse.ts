import pdfParse from 'pdf-parse/lib/pdf-parse.js'
import JSZip from 'jszip'
import { createLogger } from '../logging'

const log = createLogger('file-parse')

/** Extract slide text from a .pptx (a zip of slideN.xml files). */
async function parsePptx(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf)
  const slidePaths = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml/)?.[1] ?? 0)
      const nb = Number(b.match(/slide(\d+)\.xml/)?.[1] ?? 0)
      return na - nb
    })
  const out: string[] = []
  let i = 1
  for (const path of slidePaths) {
    const xml = await zip.files[path].async('string')
    // <a:t> holds the visible text runs. Join them into readable lines.
    const runs = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) =>
      m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    )
    if (runs.length) out.push(`Slide ${i}:\n${runs.join('\n')}`)
    i++
  }
  return out.join('\n\n')
}

// Text/code file extensions we pull out of a project .zip.
const ZIP_TEXT_RE = /\.(txt|md|markdown|json|ya?ml|xml|csv|html?|css|scss|js|jsx|ts|tsx|py|java|c|cc|cpp|h|hpp|cs|go|rs|rb|php|swift|kt|sql|sh|toml|ini|env|gradle|dockerfile|makefile)$/i
const ZIP_SKIP_RE = /(^|\/)(node_modules|\.git|dist|build|out|vendor|\.next|\.venv|__pycache__)\//i

/** Concatenate readable source/text files from a project .zip. */
async function parseZip(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf)
  const paths = Object.keys(zip.files)
    .filter((p) => !zip.files[p].dir && ZIP_TEXT_RE.test(p) && !ZIP_SKIP_RE.test(p))
    .sort()
    .slice(0, 120) // keep the payload bounded
  const out: string[] = []
  let total = 0
  for (const p of paths) {
    const content = await zip.files[p].async('string')
    const snippet = content.slice(0, 8000)
    total += snippet.length
    out.push(`--- ${p} ---\n${snippet}`)
    if (total > 400_000) break // overall cap
  }
  return out.join('\n\n')
}

/**
 * Extract text from a user-loaded document. PDFs use pdf-parse, .pptx slides are read
 * from the OOXML zip, .zip projects yield their source/text files, and everything else is
 * decoded as UTF-8 text. Returns a best-effort string (empty on failure).
 */
export async function parseFileToText(name: string, bytes: ArrayBuffer): Promise<string> {
  const buf = Buffer.from(bytes)
  const lower = name.toLowerCase()
  try {
    if (lower.endsWith('.pdf')) {
      const data = await pdfParse(buf)
      return (data.text || '').trim()
    }
    if (lower.endsWith('.pptx')) {
      return (await parsePptx(buf)).trim()
    }
    if (lower.endsWith('.zip')) {
      return (await parseZip(buf)).trim()
    }
    return buf.toString('utf8')
  } catch (err) {
    log.warn('failed to parse file', { name, err })
    return ''
  }
}
