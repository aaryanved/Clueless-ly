# Architecture & contributor guide

This document orients new contributors so you know **what you're changing and where**.
Clueless-ly is an Electron app: a Node **main** process, a sandboxed **renderer** (React),
and a thin **preload** bridge between them. OS-specific behaviour is isolated behind a
platform contract so the shared code stays identical on every OS.

## Process model

```
┌─────────────┐  IPC (invoke/handle + events)  ┌──────────────┐
│  renderer   │ ─────────────────────────────► │    main      │
│ (React UI)  │ ◄───────────────────────────── │ (Node/Electron)
└─────────────┘        via preload bridge       └──────────────┘
```

- **main** (`src/main`) owns everything privileged: OpenAI calls, transcription sockets,
  screen capture, storage, global shortcuts, window management.
- **renderer** (`src/renderer`) is the UI. It cannot touch Node/Electron directly; it
  only calls the typed API exposed on `window.clueless`.
- **preload** (`src/preload/index.ts`) defines that API surface with `contextBridge`.
- **shared** (`src/shared`) holds types and the IPC channel-name registry, imported by
  both sides. Keep it free of Node/DOM imports.

## Where things live

| Area | Path | What it does |
|---|---|---|
| App bootstrap | `src/main/index.ts` | Wires services + IPC in order, creates the overlay window |
| Platform contract | `src/main/platform/contracts.ts` | Interfaces every OS implements |
| Platform resolver | `src/main/platform/index.ts` | Picks the OS adapter (the ONE OS-aware file) |
| macOS / Windows adapters | `src/main/platform/{darwin,win32}` | Native behaviour per OS |
| OpenAI + prompts | `src/main/ai` | Client, streaming, mode-aware system prompt |
| Transcription | `src/main/transcription` | Realtime sockets, orchestrator, auto-answer |
| Context | `src/main/context` | Screen capture, context engine, user/interview/speech store |
| Sessions / settings / storage | `src/main/{sessions,settings,storage}` | Persistence + settings |
| UI | `src/renderer/components` | Overlay shell, panels, modes, drawer |
| UI state | `src/renderer/state/store.tsx` | Single reducer store fed by main→renderer events |

## The golden rule: no OS branching in feature code

Shared code depends only on the interfaces in `platform/contracts.ts`. The **only** file
that knows which OS it is running on is `platform/index.ts`. Each platform branch swaps
its body to return the native adapter. If you find yourself writing
`if (process.platform === 'darwin')` in a feature, add a method to the platform contract
instead.

## Branches

There is no shared `dev` branch. The app is maintained on two platform branches:

- **`mac`** — shared app + macOS native layer.
- **`windows`** — shared app + Windows native layer.
- **`main`** — landing docs only.

**Shared changes must be applied to both `mac` and `windows`.** A typical flow: make the
change on the branch you're testing on, then port the shared files to the other branch
(everything except `src/main/platform/{darwin,win32}` and `platform/index.ts` is shared).

## Running it

```bash
./launch.sh        # installs deps if needed, creates .env, starts dev
# or
npm install && npm run dev
```

See [setup.md](./setup.md) for full setup, permissions, and packaging.

## Conventions

- TypeScript strict mode; keep `npm run typecheck` clean.
- Never log secrets — `src/main/logging.ts` redacts, and config only ever reports whether
  a key exists, never its value.
- IPC channels are string constants in `src/shared/ipc.ts`; add there, not inline.
- User-facing strings avoid em dashes (project style).
