import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc'
import type { AiAskRequest, ContextSnapshot, TranscriptSegment } from '@shared/types'
import { orchestrator } from '../transcription/orchestrator'
import { screenObserver } from './screen-observer'
import { setAskContextProvider } from '../ai/ask-service'

/** Rough token estimate: ~4 characters per token is close enough for budgeting. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Assembles the grounding context handed to the model for each question. It pulls
 * the latest screen snapshot and the recent transcript, then trims the transcript
 * (oldest first) to stay within a token budget so we never blow the context window.
 */
export class ContextEngine {
  private maxTokens = 2000

  setMaxTokens(n: number): void {
    if (Number.isFinite(n) && n > 200) this.maxTokens = Math.floor(n)
  }

  private formatSegment(s: TranscriptSegment): string {
    const who = s.role === 'me' ? 'You' : s.role === 'them' ? 'Them' : 'System'
    return `${who}: ${s.text}`
  }

  buildContext(req: AiAskRequest): string {
    const parts: string[] = []
    let budget = this.maxTokens

    if (req.useScreenContext) {
      const screen = screenObserver.getLatest()
      if (screen) {
        const block = `Screen (captured ${new Date(screen.capturedAt).toLocaleTimeString()}):\n${screen.summary}`
        parts.push(block)
        budget -= estimateTokens(block)
      }
    }

    if (req.useTranscriptContext) {
      const recent = orchestrator.recent(100).filter((s) => s.isFinal || s.text.length > 0)
      const lines: string[] = []
      // Walk newest -> oldest, keeping what fits, then restore chronological order.
      for (let i = recent.length - 1; i >= 0; i--) {
        const line = this.formatSegment(recent[i])
        const cost = estimateTokens(line)
        if (cost > budget) break
        budget -= cost
        lines.unshift(line)
      }
      if (lines.length) parts.push(`Conversation so far:\n${lines.join('\n')}`)
    }

    return parts.join('\n\n')
  }

  getSnapshot(): ContextSnapshot {
    const transcript = orchestrator.recent(100)
    const screen = screenObserver.getLatest() ?? undefined
    const text = this.buildContext({
      question: '',
      useScreenContext: true,
      useTranscriptContext: true
    })
    return { transcript, screen, tokenEstimate: estimateTokens(text) }
  }
}

export const contextEngine = new ContextEngine()

export function registerContextIpc(): void {
  // Feed real grounding context into the ask pipeline. When the user asks with screen
  // context enabled and the last snapshot is stale, grab a fresh frame first.
  setAskContextProvider(async (req) => {
    if (req.useScreenContext) {
      const latest = screenObserver.getLatest()
      if (!latest || Date.now() - latest.capturedAt > 5000) {
        await screenObserver.capture().catch(() => {})
      }
    }
    return contextEngine.buildContext(req)
  })

  ipcMain.handle(IpcChannels.ContextCaptureScreen, async () => screenObserver.capture())
  ipcMain.handle(IpcChannels.ContextGetSnapshot, async () => contextEngine.getSnapshot())
}
