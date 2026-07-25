import pdfParse from 'pdf-parse/lib/pdf-parse.js'
import { createLogger } from '../logging'

const log = createLogger('file-parse')

/**
 * Extract text from a user-loaded document. PDFs are parsed with pdf-parse; everything
 * else is decoded as UTF-8 text. Returns a best-effort string (empty on failure).
 */
export async function parseFileToText(name: string, bytes: ArrayBuffer): Promise<string> {
  const buf = Buffer.from(bytes)
  try {
    if (name.toLowerCase().endsWith('.pdf')) {
      const data = await pdfParse(buf)
      return (data.text || '').trim()
    }
    return buf.toString('utf8')
  } catch (err) {
    log.warn('failed to parse file', { name, err })
    return ''
  }
}
