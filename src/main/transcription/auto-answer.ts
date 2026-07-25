import { createLogger } from '../logging'
import { orchestrator } from './orchestrator'
import { startAsk } from '../ai/ask-service'
import { hasApiKey } from '../config'
import type { TranscriptSegment } from '@shared/types'

const log = createLogger('auto-answer')

// Questions and spoken directives/requests both count as prompts to act on.
const PROMPT_START =
  /^(who|what|when|where|why|how|which|whose|can|could|would|should|do|does|did|is|are|was|were|will|explain|tell me|describe|walk me through|give me|show me|write|generate|create|make|build|code|list|find|search|look up|look it up|help me|compare|summari[sz]e|translate|define|calculate|convert|fix|debug|draft|suggest|recommend|let's|lets|i want|i need|i'd like|could you|can you|please)\b/i

/** Heuristic: is this transcript line a question or a request the assistant should act on? */
function looksLikePrompt(text: string): boolean {
  const t = text.trim()
  if (t.length < 8) return false
  return t.endsWith('?') || PROMPT_START.test(t)
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
    if (!looksLikePrompt(seg.text)) return
    if (!hasApiKey()) return

    answered.add(seg.id)
    // Keep the dedupe set bounded.
    if (answered.size > 500) answered.clear()

    log.info('auto-answering spoken prompt', { role: seg.role })
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
