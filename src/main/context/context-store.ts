import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc'
import type { ContextData, InterviewContext } from '@shared/types'
import { createLogger } from '../logging'
import { store } from '../storage/json-store'
import { settingsService } from '../settings/settings-service'
import { parseFileToText } from './file-parse'

const log = createLogger('context-store')
const KEY = 'contexts'

const empty = (): ContextData => ({
  user: { text: '' },
  interview: { jobDescription: '', resume: '', projects: '' },
  speech: { text: '' }
})

let data: ContextData = empty()
let loaded = false

async function load(): Promise<void> {
  if (loaded) return
  const saved = await store.readJson<ContextData>(KEY)
  if (saved) data = { ...empty(), ...saved }
  loaded = true
}

async function persist(): Promise<void> {
  await store.writeJson(KEY, data)
}

/**
 * The combined reference material handed to the model: the global user context always,
 * plus the interview material when interview mode is on and the presentation when speech
 * mode is on.
 */
export function buildReference(): string {
  const parts: string[] = []
  if (data.user.text.trim()) parts.push(`User context:\n${data.user.text.trim()}`)

  let modes = { coding: false, interview: false, debate: false, speech: false }
  try {
    modes = settingsService.get().modes
  } catch {
    /* settings not ready */
  }

  if (modes.interview) {
    const iv = data.interview
    const bits: string[] = []
    if (iv.jobDescription.trim()) bits.push(`Job description:\n${iv.jobDescription.trim()}`)
    if (iv.resume.trim()) bits.push(`Candidate resume:\n${iv.resume.trim()}`)
    if (iv.projects.trim()) bits.push(`Projects / links:\n${iv.projects.trim()}`)
    if (bits.length) parts.push(`Interview material:\n${bits.join('\n\n')}`)
  }
  if (modes.speech && data.speech.text.trim()) {
    parts.push(`Presentation content:\n${data.speech.text.trim()}`)
  }
  return parts.join('\n\n')
}

export function registerContextStoreIpc(): void {
  void load()

  ipcMain.handle(IpcChannels.ContextGetAll, async () => {
    await load()
    return data
  })

  ipcMain.handle(IpcChannels.ContextSetUser, async (_e, text: string, saved: boolean) => {
    await load()
    data.user = { text: text ?? '', savedAt: saved ? Date.now() : undefined }
    await persist()
    log.info('user context updated', { saved, chars: data.user.text.length })
  })
  ipcMain.handle(IpcChannels.ContextClearUser, async () => {
    await load()
    data.user = { text: '' }
    await persist()
  })

  ipcMain.handle(
    IpcChannels.ContextSetInterview,
    async (_e, patch: Partial<InterviewContext>, saved: boolean) => {
      await load()
      data.interview = { ...data.interview, ...patch, savedAt: saved ? Date.now() : data.interview.savedAt }
      await persist()
    }
  )
  ipcMain.handle(IpcChannels.ContextClearInterview, async () => {
    await load()
    data.interview = { jobDescription: '', resume: '', projects: '' }
    await persist()
  })

  ipcMain.handle(IpcChannels.ContextSetSpeech, async (_e, text: string, saved: boolean) => {
    await load()
    data.speech = { text: text ?? '', savedAt: saved ? Date.now() : undefined }
    await persist()
  })
  ipcMain.handle(IpcChannels.ContextClearSpeech, async () => {
    await load()
    data.speech = { text: '' }
    await persist()
  })

  ipcMain.handle(IpcChannels.ContextParseFile, async (_e, name: string, bytes: ArrayBuffer) =>
    parseFileToText(name, bytes)
  )
}
