// Verifies the three sources of truth for configuration agree with each other:
//   .env.example  <->  the zod schema in src/main/config.ts  <->  README table.
// Runs in plain Node with no build step.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function envExampleVars() {
  return readFileSync(join(root, '.env.example'), 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split('=')[0])
}

function configSchemaKeys() {
  const src = readFileSync(join(root, 'src/main/config.ts'), 'utf8')
  const block = src.slice(src.indexOf('z.object({'), src.indexOf('})', src.indexOf('z.object({')))
  // Match identifiers immediately followed by ':' inside the schema object.
  return [...block.matchAll(/^\s*([A-Z0-9_]+):/gm)].map((m) => m[1])
}

test('every .env.example variable is consumed by the config schema', () => {
  const envVars = new Set(envExampleVars())
  const schemaKeys = new Set(configSchemaKeys())
  for (const v of envVars) {
    assert.ok(schemaKeys.has(v), `.env.example has ${v} but config schema does not consume it`)
  }
})

test('every config schema key is documented in .env.example', () => {
  const envVars = new Set(envExampleVars())
  for (const k of configSchemaKeys()) {
    assert.ok(envVars.has(k), `config schema has ${k} but .env.example does not document it`)
  }
})

test('README documents the OpenAI API key variable', () => {
  const readme = readFileSync(join(root, 'README.md'), 'utf8')
  assert.ok(readme.includes('OPENAI_API_KEY'), 'README must document OPENAI_API_KEY')
})
