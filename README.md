# Clueless-ly for macOS (`mac`)

The complete macOS build of Clueless-ly — a private, always-on-top AI assistant
overlay with realtime transcription (microphone + system audio), on-demand screen
context, and an overlay that is excluded from ordinary screen sharing.

This branch = the shared app **plus** the real macOS platform implementation. See
[ARCHITECTURE.md](./ARCHITECTURE.md) for how the codebase is organised.

## Requirements

- **macOS 13 (Ventura) or newer** — system-audio capture uses ScreenCaptureKit.
- **Node.js 20+** and npm.
- An **OpenAI API key**.

## Quick start

Easiest path — the launcher installs dependencies, creates your `.env`, and starts the app:

```bash
git clone <repository-url>
cd Clueless-ly
git checkout mac
./launch.sh
```

Or do it manually:

```bash
npm install
cp .env.example .env      # then edit .env, see below
npm run dev
```

New to the codebase? See [ARCHITECTURE.md](./ARCHITECTURE.md).

> This repository's npm blocks package install scripts by default. If Electron/esbuild
> did not finish installing, approve them once and reinstall:
> ```bash
> npm approve-scripts electron && npm approve-scripts esbuild
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
| `npm run build:unpack` | Unpacked `.app` in `release/` (no signing) |
| `npm run build:mac` | Signed/notarized `.dmg` + `.zip` in `release/` |

## macOS permissions

The app requests these the first time each capability is used. macOS shows the prompts;
you can also manage them in **System Settings → Privacy & Security**.

| Permission | Needed for | Where |
|---|---|---|
| **Microphone** | Transcribing your side of the conversation | Privacy & Security → Microphone |
| **Screen Recording** | System-audio capture (ScreenCaptureKit) **and** screen context | Privacy & Security → Screen Recording |
| **Accessibility** | Only if you use global shortcuts that require it | Privacy & Security → Accessibility |

The overlay itself is excluded from screen recording via `setContentProtection`
(NSWindowSharingNone), and the screen-context pipeline captures the *screen*, not the
overlay — so the assistant does not record itself.

If a prompt was dismissed, the in-app banner links straight to the correct settings pane.

## Packaging & notarization

`npm run build:mac` produces a hardened-runtime `.dmg` and `.zip`.

- **Signing:** set a Developer ID via the standard electron-builder env
  (`CSC_LINK` / `CSC_KEY_PASSWORD`) or an installed keychain identity. Unsigned local
  builds work with `CSC_IDENTITY_AUTO_DISCOVERY=false`.
- **Notarization:** the `build/notarize.cjs` afterSign hook runs automatically when
  these are set, and is skipped otherwise:
  ```bash
  export APPLE_ID="you@example.com"
  export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
  export APPLE_TEAM_ID="ABCDE12345"
  ```
- Entitlements live in `build/entitlements.mac.plist` (hardened-runtime JIT flags +
  `com.apple.security.device.audio-input`).

## macOS-specific architecture

- `src/main/platform/darwin/` — the macOS `PlatformAdapter`:
  - `permissions.ts` — TCC status/prompts + deep links to the right settings pane.
  - `window.ts` — overlay above full-screen apps, hidden from Mission Control, content-protected.
  - `audio.ts` — advertises ScreenCaptureKit system audio.
  - `index.ts` — runs the app as a menu-bar **accessory** (no Dock icon).
- `src/main/capture-grant.ts` — grants system audio to `getDisplayMedia` via `audio: 'loopback'`.
- Secure storage uses Electron `safeStorage`, backed by the **macOS Keychain**.

## Troubleshooting

- **No transcript appears** — check the API key banner; confirm Microphone permission;
  for the other speaker, confirm Screen Recording permission (system audio needs it).
- **System audio is silent** — requires macOS 13+ and Screen Recording permission;
  toggle it off/on in Settings after granting.
- **Overlay still shows in a screen recording** — content protection depends on the OS;
  some third-party capture tools using non-standard paths may still see it. This is a
  documented OS limitation, not a guarantee of invisibility.
- **Electron failed to install** — see the `npm approve-scripts` note above.

## Known limitations

- System-audio capture is unavailable before macOS 13.
- Content protection uses the official OS mechanism only; it is not a guarantee against
  every possible capture method.
- The bundled build has no custom app icon set (default Electron icon).
