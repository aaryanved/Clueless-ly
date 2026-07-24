import OpenAI from 'openai'
import { assertApiKey, getConfig } from '../config'
import { createLogger } from '../logging'

const log = createLogger('openai')

let client: OpenAI | null = null

/** Lazily construct the SDK client. Throws a friendly error if the key is missing. */
export function getOpenAI(): OpenAI {
  const apiKey = assertApiKey()
  if (!client) {
    client = new OpenAI({ apiKey })
    log.info('openai client initialised', { model: getConfig().model }) // key never logged
  }
  return client
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * Stream a chat completion token-by-token. Yields incremental text deltas so callers
 * can forward them to the renderer as they arrive.
 */
export async function* streamChat(
  messages: ChatMessage[],
  opts: { model?: string; signal?: AbortSignal } = {}
): AsyncGenerator<string, void, unknown> {
  const openai = getOpenAI()
  const model = opts.model ?? getConfig().model
  const stream = await openai.chat.completions.create(
    { model, messages, stream: true },
    { signal: opts.signal }
  )
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content
    if (delta) yield delta
  }
}

/** Non-streaming convenience wrapper (used for summaries and short calls). */
export async function complete(
  messages: ChatMessage[],
  opts: { model?: string } = {}
): Promise<string> {
  const openai = getOpenAI()
  const model = opts.model ?? getConfig().model
  const res = await openai.chat.completions.create({ model, messages })
  return res.choices[0]?.message?.content ?? ''
}
