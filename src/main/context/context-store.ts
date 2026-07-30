import { randomUUID } from 'node:crypto'
import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc'
import type { ContextData, InterviewContext, ProfileSet } from '@shared/types'
import { createLogger } from '../logging'
import { store } from '../storage/json-store'
import { settingsService } from '../settings/settings-service'
import { parseFileToText } from './file-parse'

const log = createLogger('context-store')
const KEY = 'contexts'

type ProfileField = 'notes' | 'coverLetter'

const emptyProfileSet = (): ProfileSet => ({ profiles: [], activeId: null })

const empty = (): ContextData => ({
  user: { text: '' },
  interview: {
    jobDescription: '',
    resume: '',
    projects: '',
    notes: emptyProfileSet(),
    coverLetter: emptyProfileSet()
  },
  speech: { text: '' }
})

function activeProfileText(set: ProfileSet): string {
  return set.profiles.find((p) => p.id === set.activeId)?.text ?? ''
}

let data: ContextData = empty()
let loaded = false

async function load(): Promise<void> {
  if (loaded) return
  const saved = await store.readJson<ContextData>(KEY)
  // Shallow-spread on its own would let an older on-disk `interview` object (saved before
  // notes/coverLetter existed) fully replace the defaults, leaving those fields undefined.
  if (saved) data = { ...empty(), ...saved, interview: { ...empty().interview, ...saved.interview } }
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

  let modes = { coding: false, interview: false, speech: false }
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
    const notes = activeProfileText(iv.notes).trim()
    if (notes) bits.push(`Interview notes:\n${notes}`)
    const coverLetter = activeProfileText(iv.coverLetter).trim()
    if (coverLetter) bits.push(`Cover letter:\n${coverLetter}`)
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
    data.interview = {
      jobDescription: '',
      resume: '',
      projects: '',
      notes: emptyProfileSet(),
      coverLetter: emptyProfileSet()
    }
    await persist()
  })

  ipcMain.handle(
    IpcChannels.ContextSaveInterviewProfile,
    async (_e, field: ProfileField, name: string, text: string) => {
      await load()
      const set = data.interview[field]
      const profile = { id: randomUUID(), name: name.trim() || 'Untitled', text, savedAt: Date.now() }
      data.interview[field] = { profiles: [...set.profiles, profile], activeId: profile.id }
      await persist()
      return data.interview[field]
    }
  )

  ipcMain.handle(
    IpcChannels.ContextUpdateInterviewProfile,
    async (_e, field: ProfileField, id: string, text: string) => {
      await load()
      const set = data.interview[field]
      data.interview[field] = {
        ...set,
        profiles: set.profiles.map((p) => (p.id === id ? { ...p, text, savedAt: Date.now() } : p))
      }
      await persist()
      return data.interview[field]
    }
  )

  ipcMain.handle(
    IpcChannels.ContextSwitchInterviewProfile,
    async (_e, field: ProfileField, id: string) => {
      await load()
      data.interview[field] = { ...data.interview[field], activeId: id }
      await persist()
      return data.interview[field]
    }
  )

  ipcMain.handle(
    IpcChannels.ContextDeleteInterviewProfile,
    async (_e, field: ProfileField, id: string) => {
      await load()
      const set = data.interview[field]
      const profiles = set.profiles.filter((p) => p.id !== id)
      const activeId = set.activeId === id ? (profiles[profiles.length - 1]?.id ?? null) : set.activeId
      data.interview[field] = { profiles, activeId }
      await persist()
      return data.interview[field]
    }
  )

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
