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
  'directly. When screen or conversation context is provided, ground your answer in it. ' +
  'If the context is insufficient, say what you would need rather than inventing details.'

/**
 * Provides grounding context (screen + transcript) for a question. Batch 5 registers
 * the real implementation; until then questions are answered without extra context.
 */
export type AskContextProvider = (req: AiAskRequest) => Promise<string>
let contextProvider: AskContextProvider = async () => ''

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
    const context = await contextProvider(req).catch(() => '')
    const messages: ChatMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }]
    if (context.trim()) {
      messages.push({ role: 'system', content: `Context:\n${context}` })
    }
    messages.push({ role: 'user', content: req.question })

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

export function registerAiIpc(): void {
  ipcMain.handle(IpcChannels.AiAsk, async (_e, req: AiAskRequest) => {
    const requestId = randomUUID()
    // Fire-and-forget: return the id immediately so the UI can create the message
    // bubble, then stream tokens into it via events.
    void runAsk(requestId, req)
    return { requestId }
  })
}
