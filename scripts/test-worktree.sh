#!/usr/bin/env bash
# Isolated test checkout for verifying a branch without touching the dev:sync checkout (port 3000).
#
#   bash scripts/test-worktree.sh up     # detached worktree of HEAD + shared node_modules junction
#   bash scripts/test-worktree.sh down   # remove it safely
#
# `up` prints the apps/web path; run `npx next dev <that path> -p 3200` (e.g. via a temporary
# `web-isolated` entry in .claude/launch.json, reverted afterwards with `git checkout -- .claude/launch.json`).
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
W="$(cygpath -u "${TEMP:-/tmp}")/ssumnation-test/wt-dev"

case "${1:-}" in
  up)
    mkdir -p "$(dirname "$W")"
    [ -d "$W" ] && { echo "already exists: $W (run down first)"; exit 1; }
    git -C "$REPO" worktree add -q --detach "$W" HEAD
    MSYS_NO_PATHCONV=1 cmd /c mklink /J "$(cygpath -w "$W/node_modules")" "$(cygpath -w "$REPO/node_modules")" >/dev/null
    echo "$(cygpath -m "$W/apps/web")"
    ;;
  down)
    [ -e "$W/node_modules" ] && MSYS_NO_PATHCONV=1 cmd /c rmdir "$(cygpath -w "$W/node_modules")"
    if [ -d "$W" ]; then
      git -C "$REPO" worktree remove --force "$W" 2>/dev/null \
        || powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$(cygpath -w "$REPO/scripts/rm-worktree.ps1")" -Path "$(cygpath -w "$W")"
    fi
    git -C "$REPO" worktree prune
    echo "removed"
    ;;
  *)
    echo "usage: bash scripts/test-worktree.sh up|down"; exit 1 ;;
esac
