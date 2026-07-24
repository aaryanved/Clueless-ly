<h1 align="center">Clueless-ly</h1>

<p align="center">
  A private, always-on-top AI assistant overlay for <b>macOS</b> and <b>Windows</b>.<br/>
  Real-time transcription · on-demand screen context · excluded from screen sharing.
</p>

---

## What is this?

Clueless-ly is a small overlay that sits above your other windows. It can listen to a
conversation (your **microphone** and your computer's **system audio**), look at your
**screen** when you ask, and answer questions in context — all in a window that the
operating system keeps **out of ordinary screen recordings and shares**.

It uses the **OpenAI API** for transcription and answers. You bring your own API key.

## Which branch do I use?

This `main` branch is just the landing page. The application lives on the branches below.
Pick the one for your operating system and follow its README.

| Platform | Branch | Start here |
|---|---|---|
| 🍎 macOS | [`mac`](../../tree/mac) | [macOS README](../../tree/mac#readme) |
| 🪟 Windows | [`windows`](../../tree/windows) | [Windows README](../../tree/windows#readme) |
| 🔧 Shared development | [`dev`](../../tree/dev) | contributors only |

> **Regular users should not use `dev`.** It contains the shared cross-platform code with
> no OS-specific implementation and is not meant to be run directly.

---

## Setup — macOS

```bash
git clone <repository-url>
cd Clueless-ly
git checkout mac
npm install
cp .env.example .env
npm run dev
```

Then open `.env` and add your OpenAI API key:

1. Go to <https://platform.openai.com/api-keys>
2. Create (or select) a project, then create a new API key.
3. Copy the key.
4. Open `.env` and place it after `OPENAI_API_KEY=`:
   ```env
   OPENAI_API_KEY=sk-your-key-here
   ```
   - **Do not** wrap the value in quotation marks.
   - **Do not** commit `.env`.
   - **Do not** share your API key.

**Permissions macOS will ask for** (System Settings → Privacy & Security):

- **Microphone** — to transcribe your side of the conversation.
- **Screen Recording** — required for **system-audio capture** (ScreenCaptureKit) and for **screen context**.
- **Accessibility** — only if you use global shortcuts that need it.

Run: `npm run dev` · Build a `.dmg`: `npm run build:mac`

Full details, including notarization and troubleshooting, are in the
[macOS README](../../tree/mac#readme).

---

## Setup — Windows

```powershell
git clone <repository-url>
cd Clueless-ly
git checkout windows
npm install
Copy-Item .env.example .env    # cmd.exe:  copy .env.example .env
npm run dev
```

Then open `.env` and add your OpenAI API key (same steps as macOS above):

```env
OPENAI_API_KEY=sk-your-key-here
```
- **Do not** wrap the value in quotation marks.
- **Do not** commit `.env`.
- **Do not** share your API key.

**Permissions / prompts on Windows:**

- **Microphone** — Settings → Privacy & security → Microphone (the app links you there if blocked).
- **System audio** — captured via WASAPI loopback; **no separate permission** needed.
- **SmartScreen** — an unsigned build shows a warning on first launch → *More info → Run anyway*.

Run: `npm run dev` · Build an installer: `npm run build:win`

Full details are in the [Windows README](../../tree/windows#readme).

---

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `OPENAI_API_KEY` | ✅ | — | Auth for all OpenAI calls |
| `OPENAI_MODEL` | | `gpt-4o` | Answers + screen vision |
| `OPENAI_TRANSCRIBE_MODEL` | | `gpt-4o-mini-transcribe` | Transcription |
| `OPENAI_REALTIME_MODEL` | | `gpt-4o-realtime-preview` | Realtime streaming |
| `CLUELESSLY_LOG_LEVEL` | | `info` | Log verbosity |

If `OPENAI_API_KEY` is missing, the app does not crash — it shows a clear setup banner.

## Privacy note

The overlay excludes itself from screen capture using the **official OS mechanism**
(macOS `NSWindowSharingNone`, Windows `WDA_EXCLUDEFROMCAPTURE`). This is not a guarantee
against every possible capture method, and it requires a recent OS version. See each
platform README for exact support and limitations. Clueless-ly does **not** tamper with
capture software, hide processes, or bypass any security controls.

## License

MIT
