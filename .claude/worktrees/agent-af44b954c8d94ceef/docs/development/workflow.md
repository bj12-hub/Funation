# Development Workflow

1. Confirm requirement.
2. Locate Figma frame.
3. Identify role.
4. Identify route.
5. Identify state.
6. Identify domain.
7. Identify platform if applicable.
8. Inspect existing code.
9. Implement smallest coherent change.
10. Test.
11. Create PR.

UI flow:

```text
Figma
 ↓
Next.js Route
 ↓
Feature
 ↓
Component
 ↓
API Service
```

## Local preview with auto-sync (Windows)

Claude pushes the latest work-in-progress to the `preview` branch.
To see it locally without running git commands by hand:

```powershell
cd ~\Documents\Funation
npm run dev:sync
```

This starts the dev server and pulls new commits from `origin/preview` every 10 seconds.
The browser reloads automatically. Stop with `Ctrl + C`.
If you edit files locally, syncing pauses so your changes are not overwritten.
Syncing also pauses whenever a branch other than `preview` is checked out, so work on
`main` or `feature/*` is never reset.

## Claude working notes

How Claude builds, tests, opens and merges each screen (Figma usage, isolated test server,
`scripts/merge-pr.sh`, conventions, remaining work) is written up in
[`claude-handoff.md`](claude-handoff.md).
