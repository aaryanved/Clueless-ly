import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { z } from 'zod'
import { createLogger } from './logging'
import type { ConfigStatus } from '@shared/types'

const log = createLogger('config')

/**
 * Tiny, dependency-free .env loader. We deliberately do NOT overwrite variables that
 * are already present in the real environment, so CI / shell exports win over the file.
 */
function loadDotEnv(): void {
  const candidates = [join(process.cwd(), '.env'), join(app.getAppPath(), '.env')]
  for (const file of candidates) {
    try {
      const raw = readFileSync(file, 'utf8')
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eq = trimmed.indexOf('=')
        if (eq === -1) continue
        const key = trimmed.slice(0, eq).trim()
        let value = trimmed.slice(eq + 1).trim()
        // Strip a single layer of matching quotes if present.
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1)
        }
        if (key && process.env[key] === undefined) process.env[key] = value
      }
      log.info('loaded .env', { file })
      return
    } catch {
      /* file not present at this candidate; try next */
    }
  }
  log.info('no .env file found; relying on process environment')
}

const schema = z.object({
  OPENAI_API_KEY: z.string().default(''),
  OPENAI_MODEL: z.string().default('gpt-4o'),
  OPENAI_TRANSCRIBE_MODEL: z.string().default('gpt-4o-mini-transcribe'),
  OPENAI_REALTIME_MODEL: z.string().default('gpt-4o-realtime-preview'),
  CLUELESSLY_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info')
})

export interface AppConfig {
  openaiApiKey: string
  model: string
  transcribeModel: string
  realtimeModel: string
  logLevel: string
}

let cached: AppConfig | null = null

export function getConfig(): AppConfig {
  if (cached) return cached
  loadDotEnv()
  const parsed = schema.parse(process.env)
  cached = {
    openaiApiKey: parsed.OPENAI_API_KEY.trim(),
    model: parsed.OPENAI_MODEL,
    transcribeModel: parsed.OPENAI_TRANSCRIBE_MODEL,
    realtimeModel: parsed.OPENAI_REALTIME_MODEL,
    logLevel: parsed.CLUELESSLY_LOG_LEVEL
  }
  return cached
}

export function hasApiKey(): boolean {
  return getConfig().openaiApiKey.length > 0
}

function keyLooksValid(key: string): boolean {
  // OpenAI keys start with "sk-" (incl. "sk-proj-") and are comfortably long.
  return /^sk-[A-Za-z0-9_-]{20,}$/.test(key)
}

/**
 * Public, secret-safe view of configuration health. Only ever reports whether the
 * key exists and looks well-formed - never the value itself.
 */
export function configStatus(): ConfigStatus {
  const cfg = getConfig()
  const present = cfg.openaiApiKey.length > 0
  const looksValid = present && keyLooksValid(cfg.openaiApiKey)
  const problems: string[] = []
  if (!present) {
    problems.push(
      'OpenAI API key is not configured. Add OPENAI_API_KEY to your .env file and restart the application.'
    )
  } else if (!looksValid) {
    problems.push(
      'OPENAI_API_KEY is set but does not look like a valid OpenAI key (expected it to start with "sk-").'
    )
  }
  return {
    openaiKeyPresent: present,
    openaiKeyLooksValid: looksValid,
    model: cfg.model,
    transcriptionModel: cfg.transcribeModel,
    realtimeModel: cfg.realtimeModel,
    problems
  }
}

/**
 * Throw a clear, actionable error (not a raw stack trace) when a required secret is
 * missing. Callers use this at the boundary of any OpenAI-backed feature.
 */
export function assertApiKey(): string {
  const cfg = getConfig()
  if (!cfg.openaiApiKey) {
    throw new Error(
      'OpenAI API key is not configured. Add OPENAI_API_KEY to your .env file and restart the application.'
    )
  }
  return cfg.openaiApiKey
}
