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
  'follow-ups like "the same" or "it", but the recent conversation is NOT a source of truth - ' +
  'it may contain your own earlier mistakes. Every answer must be re-derived fresh from the ' +
  'reference material below, not copied or paraphrased from what you said last time; if a past ' +
  'turn conflicts with the reference material, or the user says a past answer was wrong, the ' +
  'reference material wins and you correct course. Format answers in Markdown: use **bold** ' +
  'for key points and fenced code blocks with a language tag for any code. If information is ' +
  'insufficient, say what you would need rather than inventing details.'

function activeModes(): AppModes {
  try {
    return settingsService.get().modes
  } catch {
    return { coding: false, interview: false, speech: false }
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
      'INTERVIEW MODE. The reference material - especially any "Interview notes" - is not ' +
        'background flavor, it is the authoritative, literal source of truth for this specific ' +
        'interview: real names, findings, bugs, decisions, and facts the user has already ' +
        'prepared. Treat it like a script you are pulling from, not inspiration. Before ' +
        'answering, check whether the notes already cover this question (they are often ' +
        'organized as numbered findings, Q&A cards, or a walkthrough) and if so, answer using ' +
        'THAT specific content - the same entities, names, causes, and fixes - never a generic ' +
        'or textbook-sounding substitute (e.g. do not invent an unrelated bug like "sequential ' +
        'API calls" or "switched to Promises" if the notes describe a different, specific bug). ' +
        'If this exact question was asked earlier in the conversation and answered generically ' +
        'or wrong, do not repeat that same wrong answer for consistency - go back to the notes ' +
        'and answer correctly this time; a prior turn is never a valid excuse to stay wrong. ' +
        'If the notes explicitly say not to claim something, never claim it. Only fall back to ' +
        'general knowledge, clearly framed as inference rather than fact, when the notes truly ' +
        'do not address the question. Produce a first-person answer the user can read ALOUD ' +
        'verbatim without having to think further, sized to run 30-90 seconds spoken aloud ' +
        '(roughly 75-200 words) - long enough to show depth, short enough the interviewer does ' +
        'not lose the thread. Lead with the direct answer or core point first, do not build up ' +
        'to it; support it with one specific concrete example or piece of evidence drawn from ' +
        'the notes; close with a brief result or takeaway rather than trailing off. Sound ' +
        'confident but not rehearsed, conversational rather than scripted, like explaining to a ' +
        'smart colleague. Favor specifics - a real detail, a number, a project name - over vague ' +
        'claims. For behavioral questions, shape the answer as situation, action the user ' +
        'personally took, and result or lesson, with the action the longest part since that is ' +
        'what is being evaluated.'
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
    'Recent conversation (for resolving follow-ups only - these past answers were not ' +
    "verified and may be wrong; re-derive from the reference material rather than trusting " +
    'them):\n' +
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
        (reference ? `Reference material from the user (authoritative source of truth - use it, don't override it with general knowledge):\n${reference}\n\n` : '') +
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
        messages.push({
          role: 'system',
          content: `Reference material from the user (authoritative source of truth - use it, don't override it with general knowledge):\n${reference}`
        })
      }
      // Prior exchanges as real turns so follow-ups have continuity. These are NOT
      // verified - flag that so the model re-derives answers instead of anchoring on
      // (possibly wrong) things it said earlier in the session.
      if (history.length) {
        messages.push({
          role: 'system',
          content:
            'The following prior turns are for resolving follow-ups only (e.g. "the same", ' +
            "\"it\") - they were not verified and may contain your own earlier mistakes. Do " +
            'not treat them as facts or repeat their content just for consistency; always ' +
            're-derive the answer from the reference material above.'
        })
        for (const h of history) {
          messages.push({ role: 'user', content: h.question })
          messages.push({ role: 'assistant', content: h.answer })
        }
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
