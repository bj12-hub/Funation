<#
  Funation dev server with auto-sync (Windows PowerShell)

  - Starts the Next.js dev server (http://localhost:3000)
  - Every few seconds, checks GitHub for new commits on the preview branch
    and applies them locally. The browser refreshes automatically.
  - If package.json / package-lock.json changed, runs npm install and restarts the server.

  Usage (from the repository root):
    npm run dev:sync
  Stop with Ctrl + C.

  NOTE: this script resets the local branch to match GitHub.
  If you have local, uncommitted edits, syncing is skipped so nothing is lost.
#>
param(
  [string]$Branch = "preview",
  [int]$IntervalSeconds = 10
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

function Write-Sync([string]$Message, [string]$Color = "Cyan") {
  Write-Host ("[sync {0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $Message) -ForegroundColor $Color
}

function Start-DevServer {
  return Start-Process -FilePath "npm.cmd" -ArgumentList "run", "dev:web" -NoNewWindow -PassThru
}

function Stop-DevServer($Process) {
  if ($Process -and -not $Process.HasExited) {
    # /T kills the whole process tree (npm -> node -> next)
    taskkill /PID $Process.Id /T /F | Out-Null
  }
}

Write-Sync "Fetching '$Branch' from GitHub..."
git fetch origin $Branch --quiet
if ($LASTEXITCODE -ne 0) { Write-Sync "Could not fetch origin/$Branch. Check the branch name." "Red"; exit 1 }

if (git status --porcelain) {
  Write-Sync "You have local changes. Commit or discard them first (git stash), then run again." "Yellow"
  exit 1
}

git checkout -B $Branch "origin/$Branch" --quiet
Write-Sync ("On {0}: {1}" -f $Branch, (git log -1 --format="%h %s"))

npm.cmd install --no-audit --no-fund --loglevel=error
$server = Start-DevServer

try {
  while ($true) {
    Start-Sleep -Seconds $IntervalSeconds

    git fetch origin $Branch --quiet 2>$null
    if ($LASTEXITCODE -ne 0) { continue }

    $local = (git rev-parse HEAD).Trim()
    $remote = (git rev-parse "origin/$Branch").Trim()
    if ($local -eq $remote) { continue }

    if (git status --porcelain) {
      Write-Sync "New commits on GitHub, but local changes exist - skipping sync." "Yellow"
      continue
    }

    $changed = git diff --name-only $local $remote
    git reset --hard $remote --quiet
    Write-Sync ("Updated: {0}" -f (git log -1 --format="%h %s")) "Green"

    if ($changed -match "package(-lock)?\.json$") {
      Write-Sync "Dependencies changed - reinstalling and restarting the dev server..." "Yellow"
      Stop-DevServer $server
      npm.cmd install --no-audit --no-fund --loglevel=error
      $server = Start-DevServer
    }
    elseif ($changed -match "next\.config\.") {
      Write-Sync "next.config changed - restarting the dev server..." "Yellow"
      Stop-DevServer $server
      $server = Start-DevServer
    }
  }
}
finally {
  Write-Sync "Stopping dev server..."
  Stop-DevServer $server
}
