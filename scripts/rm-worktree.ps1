param([Parameter(Mandatory = $true)][string]$Path)
# Deletes a leftover worktree folder that `git worktree remove` could not (long .next paths).
# Refuses while a node_modules link is still inside, so the shared node_modules is never touched.
# Usage: powershell -NoProfile -File scripts/rm-worktree.ps1 -Path <worktree folder>
if (-not (Test-Path -LiteralPath $Path)) { "already removed"; exit 0 }
if (Test-Path -LiteralPath (Join-Path $Path "node_modules")) { "node_modules link still present - not deleting"; exit 1 }
cmd /c rmdir /s /q ("\\?\" + $Path)
if (Test-Path -LiteralPath $Path) { "failed to remove $Path"; exit 1 } else { "removed" }
