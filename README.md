<h1 align="center">Clueless-ly</h1>

<p align="center">
  A private, always-on-top AI assistant overlay for macOS and Windows.<br/>
  Real-time transcription, on-demand screen context, excluded from screen sharing.
</p>

<p align="center">
  <img alt="macOS: ready to test" src="https://img.shields.io/badge/macOS-ready%20to%20test-32d74b?logo=apple&logoColor=white" />
  <img alt="Windows: work in progress" src="https://img.shields.io/badge/Windows-work%20in%20progress-f5a623?logo=windows&logoColor=white" />
  <img alt="Electron" src="https://img.shields.io/badge/Electron-2c2e3b?logo=electron&logoColor=9feaf9" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white" />
  <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue" />
</p>

---

## What is this?

Clueless-ly is a small overlay that sits above your other windows. It can listen to a
conversation (your **microphone** and your computer's **system audio**), look at your
**screen** when you ask, and answer questions in context, all in a window that the
operating system keeps **out of ordinary screen recordings and shares**.

It uses the **OpenAI API** for transcription and answers. You bring your own API key.

## Project status

<img alt="Apple" src="https://img.shields.io/badge/macOS-000000?logo=apple&logoColor=white" align="left" />&nbsp; **Ready to test.** The macOS build works end to end: realtime transcription, screen
context, modes (coding / interview / speech), push-to-talk, and the private overlay. Try
it and report issues.

<img alt="Windows" src="https://img.shields.io/badge/Windows-0078D6?logo=windows&logoColor=white" align="left" />&nbsp; **Work in progress.** The shared app and the Windows platform layer are implemented and
build, but have **not yet been verified on Windows hardware**. Expect rough edges.

## Which branch do I use?

This `main` branch is just the landing page. The application lives on the platform
branches below.

| Platform | Branch | Status | Start here |
|---|---|---|---|
| macOS | [`mac`](../../tree/mac) | **Ready to test** | [macOS README](../../tree/mac#readme) |
| Windows | [`windows`](../../tree/windows) | **Work in progress** | [Windows README](../../tree/windows#readme) |

## Get started

The fastest path on either platform:

```bash
git clone <repository-url>
cd Clueless-ly
git checkout mac        # or: git checkout windows
./launch.sh             # Windows: ./launch.ps1
```

The launcher installs dependencies, creates your `.env`, and starts the app. You then add
your OpenAI API key to `.env`.

**Full instructions** — dependencies, the OpenAI key, OS permissions, and packaging — are
in **[setup.md](./setup.md)**.

Contributing? Each platform branch has an **[ARCHITECTURE.md](../../tree/mac/ARCHITECTURE.md)**
that explains the codebase.

## Privacy note

The overlay excludes itself from screen capture using the **official OS mechanism**
(macOS `NSWindowSharingNone`, Windows `WDA_EXCLUDEFROMCAPTURE`). This is not a guarantee
against every possible capture method, and it requires a recent OS version. Clueless-ly
does **not** tamper with capture software, hide processes, or bypass any security controls.

## License

[MIT](./LICENSE)
