import { randomUUID } from 'node:crypto'
import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc'
import type { AiAskRequest } from '@shared/types'
import { createLogger } from '../logging'
import { events } from '../events'
import { settingsService } from '../settings/settings-service'
import { buildReference } from '../context/context-store'
import type { AppModes } from '@shared/types'
import { streamChat, streamWebSearch, type ChatMessage } from './openai-client'

const log = createLogger('ai:ask')

const BASE_PROMPT =
  'You are Clueless-ly, a discreet real-time on-screen assistant. Treat everything the ' +
  'user says or types - questions, requests, and instructions (for example "give me the ' +
  'code for a for loop in Java") - as a task to carry out directly and concisely. When a ' +
  'screenshot of the screen is provided, read it carefully and quote relevant on-screen ' +
  'text (titles, prices, labels, specs) exactly; ignore any people or faces in it and ' +
  'never refuse a task because a person appears - focus on the on-screen content and the ' +
  'question. Use the recent conversation to resolve ' +
  'follow-ups like "the same" or "it". Format answers in Markdown: use **bold** for key ' +
  'points and fenced code blocks with a language tag for any code. If information is ' +
  'insufficient, say what you would need rather than inventing details.'

function activeModes(): AppModes {
  try {
    return settingsService.get().modes
  } catch {
    return { coding: false, interview: false, chess: false, speech: false }
  }
}

/** Compose the system prompt from the base plus any active modes. */
function buildSystemPrompt(): string {
  const m = activeModes()
  const parts = [BASE_PROMPT]

  if (m.coding && m.interview) {
    // Technical interview: code + a spoken walkthrough.
    parts.push(
      'TECHNICAL INTERVIEW MODE. The user is in a live technical interview and needs to ' +
        'both write code and narrate it. Respond in exactly two parts: (1) a single fenced ' +
        'code block with the complete, correct, idiomatic solution; then (2) under a ' +
        '"**Walkthrough**" heading, a first-person script of what to SAY while writing that ' +
        'code, step by step ("First I\'ll set up two pointers...", "Now I handle the edge ' +
        'case where..."), as if explaining to an interviewer. Keep the narration natural and ' +
        'speakable, mapping to the code in order.'
    )
  } else if (m.coding) {
    parts.push(
      'CODING MODE. Prioritise a correct, complete, efficient and idiomatic solution. Give ' +
        'the full code in a fenced block with the right language tag, then a brief note on ' +
        'complexity and key edge cases. Favour working code over prose.'
    )
  } else if (m.interview) {
    parts.push(
      'INTERVIEW MODE. Help the user answer interview questions using the provided reference ' +
        'material and context. Produce a comprehensive, well-structured, first-person answer ' +
        'the user can read ALOUD verbatim without having to think further. Be specific and ' +
        'confident; prefer concrete examples grounded in the reference material.'
    )
  }

  if (m.speech) {
    parts.push(
      'SPEECH Q&A MODE. The user has just given a presentation whose content is provided as ' +
        'reference material. Answer audience questions strictly in line with what was ' +
        'presented, in a confident first-person voice the user can read aloud. Do not ' +
        'contradict the presentation; if a question is outside its scope, answer briefly and ' +
        'say it goes beyond what was presented.'
    )
  }

  return parts.join('\n\n')
}

/**
 * Grounding context for a request: transcript text plus, optionally, a screenshot of
 * the current screen passed directly to the vision model.
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

/** Hook that lets the session manager persist finished answers. */
export type AnswerSink = (req: AiAskRequest, question: string, answer: string) => void
let answerSink: AnswerSink = () => {}
export function setAnswerSink(fn: AnswerSink): void {
  answerSink = fn
}

// Short rolling memory of recent exchanges so follow-ups ("the same", "it") resolve.
const history: Array<{ question: string; answer: string }> = []
function pushHistory(question: string, answer: string): void {
  if (!answer.trim()) return
  history.push({ question, answer })
  while (history.length > 6) history.shift()
}
export function clearAskHistory(): void {
  history.length = 0
}
/**
 * Replace the rolling memory wholesale. Used when the user reopens a saved session so
 * follow-ups continue from where that conversation left off.
 */
export function setAskHistory(entries: Array<{ question: string; answer: string }>): void {
  history.length = 0
  for (const e of entries.slice(-6)) {
    if (e.answer.trim()) history.push({ question: e.question, answer: e.answer })
  }
}

// Detect an explicit request to search the web.
const SEARCH_INTENT =
  /\b(search (online|the web|for|up)|look (it |this |that )?up|google|on the (web|internet)|browse|latest news|up to date|most recent)\b/i
function wantsWebSearch(text: string): boolean {
  return SEARCH_INTENT.test(text)
}

function historyText(): string {
  if (!history.length) return ''
  return (
    'Recent conversation:\n' +
    history.map((h) => `User: ${h.question}\nAssistant: ${h.answer}`).join('\n') +
    '\n'
  )
}

async function runAsk(requestId: string, req: AiAskRequest): Promise<void> {
  let answer = ''
  try {
    const context = await contextProvider(req).catch(() => ({ text: '' }) as AskContext)

    const reference = buildReference().trim()
    const systemPrompt = buildSystemPrompt()

    if (wantsWebSearch(req.question)) {
      // Web-search path (text only): fold in reference material, history + context.
      const prompt =
        `${systemPrompt}\n\n` +
        (reference ? `Reference material from the user:\n${reference}\n\n` : '') +
        `${historyText()}` +
        (context.text.trim() ? `On-screen conversation:\n${context.text}\n\n` : '') +
        `Task: ${req.question}`
      for await (const token of streamWebSearch(prompt)) {
        answer += token
        events.aiToken({ requestId, token })
      }
    } else {
      const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }]
      if (reference) {
        messages.push({ role: 'system', content: `Reference material from the user:\n${reference}` })
      }
      // Prior exchanges as real turns so follow-ups have continuity.
      for (const h of history) {
        messages.push({ role: 'user', content: h.question })
        messages.push({ role: 'assistant', content: h.answer })
      }
      if (context.text.trim()) {
        messages.push({ role: 'system', content: `On-screen conversation:\n${context.text}` })
      }
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
    }

    events.aiDone({ requestId, text: answer })
    pushHistory(req.question, answer)
    answerSink(req, req.question, answer)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.warn('ask failed', { err })
    events.error({ scope: 'ai', message })
    events.aiDone({ requestId, text: answer || `Something went wrong: ${message}` })
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
