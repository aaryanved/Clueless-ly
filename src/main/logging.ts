// Minimal structured logger with a secret-redaction pass. Everything that could
// print configuration values goes through here so we never leak an API key to a
// terminal, log file, or crash report.

type Level = 'debug' | 'info' | 'warn' | 'error'

const SECRET_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9_-]{16,}/g, // OpenAI-style keys
  /Bearer\s+[A-Za-z0-9._-]{16,}/gi
]

function redact(input: unknown): unknown {
  if (typeof input === 'string') {
    return SECRET_PATTERNS.reduce((acc, re) => acc.replace(re, '«redacted»'), input)
  }
  if (input instanceof Error) {
    return { name: input.name, message: redact(input.message), stack: undefined }
  }
  if (Array.isArray(input)) return input.map(redact)
  if (input && typeof input === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(input)) {
      // Never serialise fields whose name suggests a secret.
      if (/key|secret|token|password|authorization/i.test(k)) {
        out[k] = v == null ? v : '«redacted»'
      } else {
        out[k] = redact(v)
      }
    }
    return out
  }
  return input
}

function emit(level: Level, scope: string, msg: string, meta?: unknown) {
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} (${scope}) ${msg}`
  const safeMeta = meta === undefined ? undefined : redact(meta)
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  if (safeMeta === undefined) fn(line)
  else fn(line, safeMeta)
}

export function createLogger(scope: string) {
  return {
    debug: (msg: string, meta?: unknown) => emit('debug', scope, msg, meta),
    info: (msg: string, meta?: unknown) => emit('info', scope, msg, meta),
    warn: (msg: string, meta?: unknown) => emit('warn', scope, msg, meta),
    error: (msg: string, meta?: unknown) => emit('error', scope, msg, meta)
  }
}

export type Logger = ReturnType<typeof createLogger>
