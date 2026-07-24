# Clueless-ly for Windows (`windows`)

The Windows build of Clueless-ly — a private, always-on-top AI assistant overlay with
realtime transcription (microphone + system audio), on-demand screen context, and an
overlay excluded from ordinary screen sharing.

This branch = the shared core from [`dev`](../../tree/dev) **plus** the Windows platform
implementation.

> ### ⚠️ Verification status
> This branch was implemented and type-checked/built on macOS. The Windows-specific
> code paths (WASAPI loopback capture, `WDA_EXCLUDEFROMCAPTURE` content protection,
> DPAPI secure storage, NSIS packaging) use documented Windows/Electron APIs but have
> **not yet been executed on Windows hardware**. Items to confirm on a real Windows
> machine are listed under *Requires platform verification* below.

## Requirements

- **Windows 10 version 2004 (build 19041) or newer** — required for
  `WDA_EXCLUDEFROMCAPTURE` overlay privacy.
- **Node.js 20+** and npm.
- An **OpenAI API key**.

## Quick start

```powershell
git clone <repository-url>
cd Clueless-ly
git checkout windows
npm install
Copy-Item .env.example .env    # then edit .env — see below
npm run dev
```

Command Prompt (cmd.exe) equivalent for the copy step:

```bat
copy .env.example .env
```

> This repository's npm blocks package install scripts by default. If Electron/esbuild
> did not finish installing, approve them once and reinstall:
> ```powershell
> npm approve-scripts electron
> npm approve-scripts esbuild
> npm install
> ```

### Configure your OpenAI key

1. Go to https://platform.openai.com/api-keys
2. Create (or select) a project and create a new API key.
3. Copy the key.
4. Open `.env` and put it after `OPENAI_API_KEY=`:
   ```env
   OPENAI_API_KEY=sk-your-key-here
   ```
   Do **not** add quotation marks. Do **not** commit `.env`. Do **not** share the key.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `OPENAI_API_KEY` | ✅ | — | Auth for all OpenAI calls |
| `OPENAI_MODEL` | | `gpt-4o` | Answers + screen vision |
| `OPENAI_TRANSCRIBE_MODEL` | | `gpt-4o-mini-transcribe` | Transcription |
| `OPENAI_REALTIME_MODEL` | | `gpt-4o-realtime-preview` | Realtime streaming |
| `CLUELESSLY_LOG_LEVEL` | | `info` | Log verbosity |

If the key is missing the app does **not** crash — it shows a clear banner:
*"OpenAI API key is not configured. Add OPENAI_API_KEY to your .env file and restart."*

## Run / build commands

| Command | What it does |
|---|---|
| `npm run dev` | Run with hot reload |
| `npm run build` | Build main + preload + renderer into `out/` |
| `npm run build:unpack` | Unpacked app in `release/` (no installer) |
| `npm run build:win` | NSIS installer (`.exe`) in `release/` |

## Windows permissions & prompts

| Capability | Needed for | Notes |
|---|---|---|
| **Microphone** | Transcribing your side | Governed by **Settings → Privacy & security → Microphone**. The app links there if blocked. |
| **System audio** | Transcribing the other side | WASAPI loopback on the default render device — **no separate permission** on Windows. |
| **Screen** | Screen context | No per-app screen permission on Windows. |
| **SmartScreen** | First launch of an unsigned build | Click *More info → Run anyway*, or ship a signed build (see below). |

The overlay excludes itself from capture via `setContentProtection`
(`SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)`), and the screen-context pipeline
captures the screen, not the overlay — so the assistant does not record itself.

## Audio device changes

WASAPI loopback follows the **current default render device**. The renderer listens for
`devicechange` and re-acquires the stream, so switching between speakers, headphones,
Bluetooth or USB devices — or a device disconnect — keeps transcription running.

## Packaging & signing

`npm run build:win` produces an NSIS installer.

- **Signing:** provide a code-signing certificate via electron-builder env
  (`CSC_LINK` + `CSC_KEY_PASSWORD`) or `win.certificateSubjectName` for an installed
  cert. Unsigned installers build fine but trigger SmartScreen on first run.
- Config lives in `electron-builder.yml` (`win` + `nsis` sections).

## Windows-specific architecture

- `src/main/platform/win32/` — the Windows `PlatformAdapter`:
  - `permissions.ts` — microphone privacy status + `ms-settings:` deep links.
  - `window.ts` — overlay content protection via `WDA_EXCLUDEFROMCAPTURE`, off the taskbar/Alt-Tab.
  - `audio.ts` — advertises WASAPI loopback system audio.
- `src/main/capture-grant.ts` — grants system audio to `getDisplayMedia` via `audio: 'loopback'`.
- Secure storage uses Electron `safeStorage`, backed by **Windows DPAPI**.

## Requires platform verification

Run these on Windows 10 2004+ / 11 and confirm:

1. `npm run dev` launches the overlay and it stays always-on-top.
2. Overlay is invisible in a Teams/Zoom/OBS screen share (content protection).
3. Microphone transcription produces "You" segments.
4. WASAPI loopback produces "Them" segments from played audio.
5. Switching default output device (headphones/Bluetooth/USB) auto-reconnects audio.
6. DPAPI secure storage round-trips (Settings shows secure backend available).
7. Global shortcuts register (no conflict) and toggle the overlay.
8. `npm run build:win` produces a working installer; first-run SmartScreen handled.
9. Multi-monitor + mixed-DPI: overlay positions correctly; screen capture uses the right display.
10. Sleep/wake: audio resumes without duplicate transcript segments.

## Known limitations

- Content protection requires Windows 10 2004+; older builds may still be captured.
- Content protection uses the official OS mechanism only; not a guarantee against every
  capture method.
- The bundled build has no custom app icon set (default Electron icon).
