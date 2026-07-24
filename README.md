# Clueless-ly — Shared Core (`dev`)

> This is the **shared development branch**. It contains the cross-platform
> application core with no OS-specific native implementation. Regular users should
> not run this branch — use [`mac`](../../tree/mac) or [`windows`](../../tree/windows).

Clueless-ly is a private, always-on-top AI assistant overlay. It listens to a
conversation (your microphone + system audio), watches your screen when you ask, and
answers questions in a small overlay that is excluded from ordinary screen sharing.

## Architecture

The golden rule: **build shared functionality once, keep OS code behind a contract.**

```
src/
  main/                 Electron main process (Node)
    config.ts           .env loading + secret validation (never logs the key)
    logging.ts          structured logger with secret redaction
    events.ts           main -> renderer event bus
    ai/                 OpenAI client + streaming ask pipeline
    transcription/      OpenAI Realtime sessions + orchestrator
    context/            screen observer (vision) + context engine (token budget)
    sessions/           session/notes/summary manager
    storage/            StorageAdapter contract + JSON implementation
    settings/           persisted settings + side effects
    platform/
      contracts.ts      PlatformAdapter + Permission/Audio/Screen/Window/... interfaces
      base/             cross-platform implementations (Electron APIs)
      index.ts          resolvePlatform() — swapped per platform branch
  preload/              contextBridge API surface (window.clueless)
  renderer/             React overlay UI + state store
  shared/               types + IPC channel names (no Node/Electron/DOM imports)
```

Shared code depends only on the interfaces in `platform/contracts.ts`. There is **no
`if (process.platform === ...)` branching in feature code** — the only file that
knows which OS it is running on is `platform/index.ts`, which each platform branch
replaces to return its native adapter.

## Platform contract

| Adapter | Responsibility |
|---|---|
| `PermissionAdapter` | check / request / open-settings for mic, screen, accessibility |
| `AudioAdapter` | capabilities + how system audio is captured (loopback vs ScreenCaptureKit) |
| `ScreenAdapter` | enumerate sources, capture a still frame |
| `SecureStorageAdapter` | OS-native credential storage (Keychain / DPAPI) |
| `WindowAdapter` | overlay behaviour: content protection, always-on-top, click-through |
| `GlobalShortcutAdapter` | register global hotkeys + platform default bindings |
| `SystemInfoAdapter` | platform description reported to the UI |

## Getting started (development)

```bash
git clone <repository-url>
cd Clueless-ly
git checkout dev
npm install
cp .env.example .env      # then add your OpenAI API key
npm run dev
```

> **Note:** this repository's npm setup blocks package install scripts by default. If
> `electron`/`esbuild` did not finish installing, approve them once:
> `npm approve-scripts electron && npm approve-scripts esbuild`, then re-run
> `npm install`.

### Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `OPENAI_API_KEY` | ✅ | — | Auth for all OpenAI calls. Get one at https://platform.openai.com/api-keys |
| `OPENAI_MODEL` | | `gpt-4o` | Answer + vision model |
| `OPENAI_TRANSCRIBE_MODEL` | | `gpt-4o-mini-transcribe` | Transcription model |
| `OPENAI_REALTIME_MODEL` | | `gpt-4o-realtime-preview` | Realtime streaming model |
| `CLUELESSLY_LOG_LEVEL` | | `info` | `debug` / `info` / `warn` / `error` |

Do **not** wrap values in quotes. Never commit `.env`.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Run the app with hot reload |
| `npm run build` | Build main + preload + renderer |
| `npm run typecheck` | Type-check node + web projects |
| `npm test` | Run the Node test suite |

## Branch model

```
main      landing page / README only
 └─ dev   shared cross-platform core (this branch)
    ├─ mac      dev + real macOS implementation
    └─ windows  dev + real Windows implementation
```

Shared bugs are fixed **here on `dev`**, then merged/cherry-picked into `mac` and
`windows`. Platform-specific fixes stay on their platform branch.
