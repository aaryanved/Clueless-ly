import { randomUUID } from 'node:crypto'
import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc'
import type { AiAskRequest } from '@shared/types'
import { createLogger } from '../logging'
import { events } from '../events'
import { streamChat, type ChatMessage } from './openai-client'

const log = createLogger('ai:ask')

const SYSTEM_PROMPT =
  'You are Clueless-ly, a discreet real-time on-screen assistant. Answer concisely and ' +
  'directly. When a screenshot of the user\'s screen is provided, read it carefully and ' +
  'transcribe any relevant on-screen text (titles, prices, labels, specs) exactly as ' +
  'written before answering. When conversation context is provided, ground your answer ' +
  'in it. If the information is insufficient, say what you would need rather than ' +
  'inventing details.'

/**
 * Grounding context for a question: transcript text plus, optionally, a screenshot of
 * the current screen that is passed directly to the vision model (higher fidelity than
 * a pre-summarised description).
 */
export interface AskContext {
  text: string
  imageDataUrl?: string
}

export type AskContextProvider = (req: AiAskRequest) => Promise<AskContext>
let contextProvider: AskContextProvider = async () => ({ text: '' })

export function setAskContextProvider(fn: AskContextProvider): void {
  contextProvider = fn
}

/** Hook that lets Batch 6 persist finished answers to the active session. */
export type AnswerSink = (req: AiAskRequest, question: string, answer: string) => void
let answerSink: AnswerSink = () => {}
export function setAnswerSink(fn: AnswerSink): void {
  answerSink = fn
}

async function runAsk(requestId: string, req: AiAskRequest): Promise<void> {
  let answer = ''
  try {
    const context = await contextProvider(req).catch(() => ({ text: '' }) as AskContext)
    const messages: ChatMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }]
    if (context.text.trim()) {
      messages.push({ role: 'system', content: `Conversation context:\n${context.text}` })
    }
    // Pass the screenshot directly to the model (high detail) alongside the question.
    if (context.imageDataUrl) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: req.question },
          { type: 'image_url', image_url: { url: context.imageDataUrl, detail: 'high' } }
        ]
      })
    } else {
      messages.push({ role: 'user', content: req.question })
    }

    for await (const token of streamChat(messages)) {
      answer += token
      events.aiToken({ requestId, token })
    }
    events.aiDone({ requestId, text: answer })
    answerSink(req, req.question, answer)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.warn('ask failed', { err })
    events.error({ scope: 'ai', message })
    // Still close out the message so the UI stops showing a spinner.
    events.aiDone({ requestId, text: answer || `⚠️ ${message}` })
  }
}

/**
 * Start an answer stream. `announce: true` first emits an ai-question event so the UI
 * can create a message bubble - used for auto-answers where the renderer did not
 * initiate the request. Manual asks create their bubble from the invoke() return value.
 */
export function startAsk(req: AiAskRequest, opts: { announce?: boolean } = {}): string {
  const requestId = randomUUID()
  if (opts.announce) {
    events.aiQuestion({ requestId, question: req.question, source: 'auto' })
  }
  void runAsk(requestId, req)
  return requestId
}

export function registerAiIpc(): void {
  ipcMain.handle(IpcChannels.AiAsk, async (_e, req: AiAskRequest) => {
    // Fire-and-forget: return the id immediately so the UI can create the message
    // bubble, then stream tokens into it via events.
    return { requestId: startAsk(req) }
  })
}
