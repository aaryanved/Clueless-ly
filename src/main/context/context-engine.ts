import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc'
import type { AiAskRequest, ContextSnapshot, TranscriptSegment } from '@shared/types'
import { orchestrator } from '../transcription/orchestrator'
import { screenObserver } from './screen-observer'
import { getPlatform } from '../platform'
import { settingsService } from '../settings/settings-service'
import { parseFileToText } from './file-parse'
import {
  setAskContextProvider,
  setReferenceContext,
  getReferenceContext,
  type AskContext
} from '../ai/ask-service'

/** Rough token estimate: ~4 characters per token is close enough for budgeting. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Assembles grounding context for each question: the recent transcript as text (trimmed
 * to a token budget) and, when screen context is on, a fresh high-resolution screenshot
 * passed straight to the vision model. Sending the real image rather than a
 * pre-summarised description dramatically improves reading of on-screen text.
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

  /** Transcript-only text context, newest-first within the token budget. */
  buildTranscriptText(): string {
    const recent = orchestrator.recent(100).filter((s) => s.isFinal || s.text.length > 0)
    let budget = this.maxTokens
    const lines: string[] = []
    for (let i = recent.length - 1; i >= 0; i--) {
      const line = this.formatSegment(recent[i])
      const cost = estimateTokens(line)
      if (cost > budget) break
      budget -= cost
      lines.unshift(line)
    }
    return lines.join('\n')
  }

  /** Gather the full context (text + optional screenshot) for an ask. */
  async gather(req: AiAskRequest): Promise<AskContext> {
    const text = req.useTranscriptContext ? this.buildTranscriptText() : ''
    let imageDataUrl: string | undefined
    // Screen capture requires the per-request flag and the global setting, and is
    // suppressed in pure interview / speech modes: those answer from transcript +
    // reference material, and a screenshot of the other person's face makes the model
    // refuse ("I can't identify people in images"). Coding / technical interview keep
    // the screen because the problem is on it.
    let screenSettingOn = true
    let modeAllowsScreen = true
    try {
      const s = settingsService.get()
      screenSettingOn = s.captureScreenContext
      const m = s.modes
      if (m.speech) modeAllowsScreen = false
      if (m.interview && !m.coding) modeAllowsScreen = false
    } catch {
      /* settings not ready yet */
    }
    if (req.useScreenContext && screenSettingOn && modeAllowsScreen) {
      const frame = await getPlatform().screen.captureFrame().catch(() => null)
      if (frame) imageDataUrl = frame.dataUrl
    }
    return { text, imageDataUrl }
  }

  getSnapshot(): ContextSnapshot {
    const transcript = orchestrator.recent(100)
    const screen = screenObserver.getLatest() ?? undefined
    const text = this.buildTranscriptText()
    return { transcript, screen, tokenEstimate: estimateTokens(text) }
  }
}

export const contextEngine = new ContextEngine()

export function registerContextIpc(): void {
  // Feed real grounding context into the ask pipeline.
  setAskContextProvider((req) => contextEngine.gather(req))

  ipcMain.handle(IpcChannels.ContextCaptureScreen, async () => screenObserver.capture())
  ipcMain.handle(IpcChannels.ContextGetSnapshot, async () => contextEngine.getSnapshot())
  ipcMain.handle(IpcChannels.ContextSetDocument, async (_e, text: string) =>
    setReferenceContext(text ?? '')
  )
  ipcMain.handle(IpcChannels.ContextGetDocument, async () => getReferenceContext())
  ipcMain.handle(IpcChannels.ContextParseFile, async (_e, name: string, bytes: ArrayBuffer) =>
    parseFileToText(name, bytes)
  )
}
