# Setup

Full setup for both platforms. For the overview, see the [README](./README.md).

Both platforms need **Node.js 20+** and an **OpenAI API key**
(<https://platform.openai.com/api-keys>).

---

## macOS

```bash
git clone <repository-url>
cd Clueless-ly
git checkout mac
./launch.sh
```

`./launch.sh` installs dependencies, creates `.env` from the template, and starts the app.
To do it manually instead:

```bash
npm install
cp .env.example .env
npm run dev
```

### OpenAI key

1. Go to <https://platform.openai.com/api-keys>.
2. Create (or select) a project, then create a new API key.
3. Copy the key.
4. Open `.env` and place it after `OPENAI_API_KEY=`:
   ```env
   OPENAI_API_KEY=sk-your-key-here
   ```
   - **Do not** wrap the value in quotation marks.
   - **Do not** commit `.env`.
   - **Do not** share your API key.

### Permissions

macOS asks for these the first time each capability is used (System Settings > Privacy &
Security):

- **Microphone** — transcribes your side of the conversation.
- **Screen Recording** — required for **system-audio capture** (ScreenCaptureKit) and for
  **screen context**.
- **Accessibility** — only if you use global shortcuts that need it.

### Run / build

- Run: `npm run dev`
- Build a `.dmg`: `npm run build:mac`

More detail, including notarization and troubleshooting, is in the
[macOS branch README](../../tree/mac#readme).

---

## Windows

> **Work in progress.** The Windows build compiles and the native layer is implemented,
> but it has not yet been verified on real Windows hardware. Use it for
> development/testing, not as a finished app.

```powershell
git clone <repository-url>
cd Clueless-ly
git checkout windows
./launch.ps1
```

`./launch.ps1` installs dependencies, creates `.env`, and starts the app. Manual path:

```powershell
npm install
Copy-Item .env.example .env    # cmd.exe:  copy .env.example .env
npm run dev
```

### OpenAI key

Same steps as macOS above — put your key after `OPENAI_API_KEY=` in `.env`:

```env
OPENAI_API_KEY=sk-your-key-here
```

### Permissions / prompts

- **Microphone** — Settings > Privacy & security > Microphone (the app links you there if
  blocked).
- **System audio** — captured via WASAPI loopback; **no separate permission** needed.
- **SmartScreen** — an unsigned build shows a warning on first launch; choose *More info >
  Run anyway*.

### Run / build

- Run: `npm run dev`
- Build an installer: `npm run build:win`

More detail is in the [Windows branch README](../../tree/windows#readme).

---

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `OPENAI_API_KEY` | yes | — | Auth for all OpenAI calls |
| `OPENAI_MODEL` | no | `gpt-4o` | Answers + screen vision |
| `OPENAI_TRANSCRIBE_MODEL` | no | `gpt-4o-mini-transcribe` | Transcription |
| `OPENAI_REALTIME_MODEL` | no | `gpt-4o-realtime-preview` | Realtime streaming |
| `CLUELESSLY_LOG_LEVEL` | no | `info` | Log verbosity |

If `OPENAI_API_KEY` is missing, the app does not crash — it shows a clear setup banner.
