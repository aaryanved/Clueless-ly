// Guard tests for the repository's secret-safety invariants. These run in plain
// Node (`node --test`) with no build step or Electron dependency.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('.gitignore excludes env files that could leak secrets', () => {
  const gi = readFileSync(join(root, '.gitignore'), 'utf8')
  for (const pattern of ['.env', '.env.local', '.env.*.local']) {
    assert.ok(gi.includes(pattern), `.gitignore should ignore ${pattern}`)
  }
})

test('.env.example contains no real secret value', () => {
  const example = readFileSync(join(root, '.env.example'), 'utf8')
  // The key line must be a bare placeholder, never a populated sk- value.
  const keyLine = example.split(/\r?\n/).find((l) => l.startsWith('OPENAI_API_KEY='))
  assert.ok(keyLine, 'OPENAI_API_KEY must be present in .env.example')
  assert.equal(keyLine.trim(), 'OPENAI_API_KEY=', 'OPENAI_API_KEY must be an empty placeholder')
  assert.ok(!/sk-[A-Za-z0-9]/.test(example), '.env.example must not contain an sk- key')
})

test('.env.example documents only variables the app consumes', () => {
  const example = readFileSync(join(root, '.env.example'), 'utf8')
  const declared = example
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split('=')[0])
  const known = new Set([
    'OPENAI_API_KEY',
    'OPENAI_MODEL',
    'OPENAI_TRANSCRIBE_MODEL',
    'OPENAI_REALTIME_MODEL',
    'CLUELESSLY_LOG_LEVEL'
  ])
  for (const name of declared) {
    assert.ok(known.has(name), `.env.example declares unknown variable: ${name}`)
  }
})
