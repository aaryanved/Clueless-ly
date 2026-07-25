#!/usr/bin/env bash
#
# launch.sh — zero-to-running launcher for Clueless-ly.
#
# For people who just cloned the repo and want to run it without knowing the toolchain.
# It installs dependencies if they are missing, finishes the Electron setup if a hardened
# npm skipped install scripts, creates a .env from the template on first run, and starts
# the app in dev mode. Safe to run repeatedly.
#
# Usage:  ./launch.sh        (from the mac or windows branch)

set -euo pipefail
cd "$(dirname "$0")"

info() { printf '\033[1;32m›\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33m!\033[0m %s\n' "$1"; }
fail() { printf '\033[1;31m✗\033[0m %s\n' "$1" >&2; exit 1; }

info "Clueless-ly launcher"

# 1. Node.js is required.
command -v node >/dev/null 2>&1 || fail "Node.js (v20+) is required. Install it from https://nodejs.org and re-run."
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 20 ] || warn "Node $(node -v) detected; v20+ is recommended."

# 2. Install dependencies on first run.
if [ ! -d node_modules ]; then
  info "Installing dependencies (first run, this can take a minute)…"
  npm install
fi

# 3. Some hardened npm setups skip package install scripts, which leaves the Electron
#    binary undownloaded. Finish that step if needed (no-op when already present).
if [ ! -f node_modules/electron/path.txt ]; then
  info "Finishing Electron setup…"
  node node_modules/electron/install.js >/dev/null 2>&1 || \
    warn "Could not auto-complete Electron install; if the app fails to start run: npm rebuild electron"
fi

# 4. Create .env from the template the first time.
if [ ! -f .env ]; then
  cp .env.example .env
  warn "Created .env from .env.example."
  warn "Open .env and set OPENAI_API_KEY before using the AI features."
fi

# 5. Launch.
info "Starting Clueless-ly…"
exec npm run dev
