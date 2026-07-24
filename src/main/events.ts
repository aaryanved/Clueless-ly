import type { BrowserWindow } from 'electron'
import { IpcChannels } from '@shared/ipc'
import type {
  AiDoneEvent,
  AiTokenEvent,
  ErrorEvent,
  ShortcutEvent,
  StatusEvent,
  TranscriptEvent
} from '@shared/types'

// A thin main -> renderer event bus. Holding the window reference here (rather than
// importing it from index.ts) keeps service modules free of import cycles.
let target: BrowserWindow | null = null

export function setEventTarget(win: BrowserWindow): void {
  target = win
}

function send(channel: string, payload: unknown): void {
  if (!target || target.isDestroyed()) return
  target.webContents.send(channel, payload)
}

export const events = {
  transcript: (e: TranscriptEvent) => send(IpcChannels.EvtTranscript, e),
  aiToken: (e: AiTokenEvent) => send(IpcChannels.EvtAiToken, e),
  aiDone: (e: AiDoneEvent) => send(IpcChannels.EvtAiDone, e),
  status: (e: StatusEvent) => send(IpcChannels.EvtStatus, e),
  error: (e: ErrorEvent) => send(IpcChannels.EvtError, e),
  shortcut: (e: ShortcutEvent) => send(IpcChannels.EvtShortcut, e)
}
