# launch.ps1 — zero-to-running launcher for Clueless-ly on Windows.
#
# For people who just cloned the repo and want to run it. Installs dependencies if
# missing, creates a .env from the template on first run, and starts the app in dev mode.
# Safe to run repeatedly.
#
# Usage (PowerShell):  ./launch.ps1     (from the windows branch)
#   If script execution is blocked, run once:
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

function Info($m) { Write-Host "> $m" -ForegroundColor Green }
function Warn($m) { Write-Host "! $m" -ForegroundColor Yellow }

Info 'Clueless-ly launcher'

# 1. Node.js is required.
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error 'Node.js (v20+) is required. Install it from https://nodejs.org and re-run.'
  exit 1
}

# 2. Install dependencies on first run.
if (-not (Test-Path node_modules)) {
  Info 'Installing dependencies (first run, this can take a minute)...'
  npm install
}

# 3. Create .env from the template the first time.
if (-not (Test-Path .env)) {
  Copy-Item .env.example .env
  Warn 'Created .env from .env.example.'
  Warn 'Open .env and set OPENAI_API_KEY before using the AI features.'
}

# 4. Launch.
Info 'Starting Clueless-ly...'
npm run dev
