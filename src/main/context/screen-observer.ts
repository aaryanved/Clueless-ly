import { randomUUID } from 'node:crypto'
import { getPlatform } from '../platform'
import { getOpenAI } from '../ai/openai-client'
import { getConfig, hasApiKey } from '../config'
import { createLogger } from '../logging'
import type { ScreenSnapshot } from '@shared/types'

const log = createLogger('screen-observer')

const OBSERVE_PROMPT =
  'You are the eyes of an on-screen assistant. In 2-4 sentences, describe what is ' +
  'currently on screen that would help answer the user\'s next question: the app in ' +
  'focus, any visible question/prompt, code, error text, or key UI. Quote short pieces ' +
  'of important visible text verbatim. Do not speculate about anything off-screen.'

/**
 * Captures a still frame of the screen and turns it into a compact textual snapshot
 * using a vision model. This is what lets the assistant answer "what's on my screen".
 * The overlay window itself is excluded from capture via content protection, so the
 * observer does not recursively describe the assistant.
 */
export class ScreenObserver {
  private latest: ScreenSnapshot | null = null

  getLatest(): ScreenSnapshot | null {
    return this.latest
  }

  async capture(): Promise<ScreenSnapshot | null> {
    const platform = getPlatform()
    const frame = await platform.screen.captureFrame().catch((err) => {
      log.warn('captureFrame failed', { err })
      return null
    })
    if (!frame) return null

    let summary = '(screen captured; description unavailable without an OpenAI API key)'
    if (hasApiKey()) {
      try {
        summary = await this.describe(frame.dataUrl)
      } catch (err) {
        log.warn('vision describe failed', { err })
        summary = '(screen captured; vision description failed)'
      }
    }

    this.latest = {
      id: randomUUID(),
      capturedAt: Date.now(),
      width: frame.width,
      height: frame.height,
      summary
    }
    return this.latest
  }

  private async describe(dataUrl: string): Promise<string> {
    const openai = getOpenAI()
    const res = await openai.chat.completions.create({
      model: getConfig().model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: OBSERVE_PROMPT },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } }
          ]
        }
      ],
      max_tokens: 300
    })
    return res.choices[0]?.message?.content?.trim() ?? ''
  }
}

export const screenObserver = new ScreenObserver()
