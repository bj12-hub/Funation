#!/usr/bin/env bash
# Usage (Git Bash, from anywhere): bash scripts/merge-pr.sh <pr-number> <branch> "<title>"
#
# Merges origin/<branch> into origin/main in a throwaway worktree, runs tsc / eslint / next build,
# pushes main (fast-forward only, so GitHub marks the PR as merged), then merges main into preview
# and pushes it so `npm run dev:sync` picks it up.
#
# Optional env: GIT_NAME, GIT_EMAIL (commit identity), CO_AUTHOR (trailer line).
set -euo pipefail
PR="$1"; BRANCH="$2"; TITLE="$3"

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(cygpath -u "${TEMP:-/tmp}")/funation-merge"
W="$WORK/wt-merge"
P="$WORK/wt-prev"
mkdir -p "$WORK"
ID=(-c "user.name=${GIT_NAME:-bj12-hub}" -c "user.email=${GIT_EMAIL:-bj12-hub@users.noreply.github.com}")
TRAILER="${CO_AUTHOR:-Co-Authored-By: Claude <noreply@anthropic.com>}"
OWNER="$(git -C "$REPO" remote get-url origin | sed -E 's#.*github.com[:/]([^/]+)/.*#\1#')"

cleanup() {
  # Remove only the junction (rmdir never follows it), and never delete the worktree while it exists.
  [ -e "$W/node_modules" ] && MSYS_NO_PATHCONV=1 cmd /c rmdir "$(cygpath -w "$W/node_modules")" >/dev/null 2>&1
  if [ -e "$W/node_modules" ]; then echo "junction still present; leaving $W in place"; return; fi
  if [ -d "$W" ]; then
    # `git worktree remove` can fail on long .next paths; fall back to a long-path rmdir.
    git -C "$REPO" worktree remove --force "$W" >/dev/null 2>&1 \
      || powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$(cygpath -w "$REPO/scripts/rm-worktree.ps1")" -Path "$(cygpath -w "$W")" || true
  fi
  git -C "$REPO" worktree prune || true
}
trap cleanup EXIT

cd "$REPO"
git fetch -q origin
cleanup
git worktree add -q --detach "$W" origin/main
git -C "$W" "${ID[@]}" merge -q --no-ff "origin/$BRANCH" -m "Merge pull request #$PR from $OWNER/$BRANCH

$TITLE

$TRAILER"
MERGE=$(git -C "$W" rev-parse HEAD)

# Share the root node_modules through a junction instead of installing again.
MSYS_NO_PATHCONV=1 cmd /c mklink /J "$(cygpath -w "$W/node_modules")" "$(cygpath -w "$REPO/node_modules")" >/dev/null
LOG="$WORK/build-$PR.log"
(cd "$W/apps/web" && npx tsc --noEmit && npx eslint . && npx next build >"$LOG" 2>&1) \
  || { echo "CHECKS FAILED (see $LOG)"; tail -30 "$LOG" 2>/dev/null; exit 1; }
echo "checks ok"

git merge-base --is-ancestor origin/main "$MERGE"
git push -q origin "$MERGE:refs/heads/main"
echo "main -> $(git -C "$W" rev-parse --short HEAD)"

# Keep preview in step with main for the local dev:sync preview (separate worktree, no build artifacts).
git worktree remove --force "$P" >/dev/null 2>&1 || true
git worktree add -q --detach "$P" origin/preview
git -C "$P" "${ID[@]}" merge -q --no-ff "$MERGE" -m "Merge main into preview

$TRAILER" || { echo "preview merge conflict"; exit 1; }
git -C "$P" push -q origin "HEAD:refs/heads/preview"
echo "preview -> $(git -C "$P" rev-parse --short HEAD)"
git worktree remove "$P"
