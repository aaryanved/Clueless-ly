import { createLogger } from '../logging'
import { orchestrator } from './orchestrator'
import { startAsk } from '../ai/ask-service'
import { hasApiKey } from '../config'
import type { TranscriptSegment } from '@shared/types'

const log = createLogger('auto-answer')

const INTERROGATIVE =
  /^(who|what|when|where|why|how|which|whose|can|could|would|should|do|does|did|is|are|was|were|will|explain|tell me|describe|walk me through|give me)\b/i

/** Heuristic: does this transcript line read like a question worth answering? */
function looksLikeQuestion(text: string): boolean {
  const t = text.trim()
  if (t.length < 10) return false
  return t.endsWith('?') || INTERROGATIVE.test(t)
}

/**
 * Watches finalised transcript segments and automatically answers any that look like a
 * question - so when the other party asks something, Clueless-ly responds without you
 * having to type it. Each segment is answered at most once.
 */
export function registerAutoAnswer(): void {
  const answered = new Set<string>()

  orchestrator.onSegment((seg: TranscriptSegment) => {
    if (!seg.isFinal) return
    if (answered.has(seg.id)) return
    if (!looksLikeQuestion(seg.text)) return
    if (!hasApiKey()) return

    answered.add(seg.id)
    // Keep the dedupe set bounded.
    if (answered.size > 500) answered.clear()

    log.info('auto-answering transcript question', { role: seg.role })
    startAsk(
      {
        question: seg.text.trim(),
        useScreenContext: true,
        useTranscriptContext: true
      },
      { announce: true }
    )
  })
}
