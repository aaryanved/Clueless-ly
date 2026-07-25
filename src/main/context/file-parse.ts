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

/**
 * Extract text from a user-loaded document. PDFs use pdf-parse, .pptx slides are read
 * from the OOXML zip, and everything else is decoded as UTF-8 text. Returns a best-effort
 * string (empty on failure).
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
    return buf.toString('utf8')
  } catch (err) {
    log.warn('failed to parse file', { name, err })
    return ''
  }
}
