# Claude Handoff (working notes)

How screens have been built so far, so a new Claude session (or account) can continue with
"이어서 진행해줘". Rules in `CLAUDE.md` still take precedence; screen status lives in
[`docs/figma/route-map.md`](../figma/route-map.md).

## 0. Direction (since 2026-09-29)

- **Code first, Figma later.** Features without a Figma frame (incl. the ideas in
  `docs/research/funnation-reference.md`) are built in code with existing tokens/components, marked
  "code-first (no Figma frame)" in comments and listed in `docs/figma/code-first-screens.md`.
  Policy numbers stay TBD; funnation values are reference only.
- Backend contract for every mock service: `docs/architecture/api-contract.md`.

## 1. Figma

- File key: `PXOl6e2HQVWsu9qx9iagJV` (single page `0:1`, too large for `get_metadata` on the page — walk node ids).
- Tools: `get_screenshot`, `get_design_context` (skillNames `resource:figma-design-to-code`), `get_metadata` on frames.
- Figma is **read-only** for this project: never call `use_figma`, uploads or other write tools.
- Image asset URLs from `get_design_context` expire after ~7 days; download into `apps/web/public/mock/...`
  and shrink large ones (e.g. PowerShell `System.Drawing`, 256–480px).
- Large extractions go to a subagent with a "read-only, report copy verbatim" prompt.

## 2. Per-screen workflow (one PR per screen or feature)

1. `git fetch origin && git checkout -b feature/<name> origin/main`
2. Extract the spec (frame ids, copy, states, sample data), then implement:
   - route in `apps/web/src/app/...`, UI in `src/features/...`, data in `src/services/...`
   - update `docs/figma/route-map.md` (route table + link wiring)
3. `npx tsc --noEmit -p apps/web`, `npx eslint` on the touched folders and `npm run test:web` (Vitest).
   Financial / idempotency / role logic gets a `*.test.ts` next to the service (helpers in `src/test/mockEnv.ts`).
4. Commit with prefix `feat:` / `fix:` / `docs:` and the co-author trailer.
5. Verify on the isolated test server (§4) — desktop 1440 and mobile 375, no horizontal scroll.
6. Push the branch, open the PR (§3), then merge:
   `bash scripts/merge-pr.sh <pr> <branch> "<title>"` (tsc + eslint + next build, push main, merge main → preview).
7. Return the checkout to preview:
   `git fetch -q origin && git checkout -q preview && git merge --ff-only -q origin/preview && git branch -f main origin/main`
8. Report to the user in Korean: what was built, what differs from Figma, TBD items, next step.

The user runs `npm run dev:sync` on port 3000 (tracks `origin/preview`). Do not start a second dev
server on that checkout; use the isolated worktree instead.

## 3. Pull requests

- Since 2026-09-29 the GitHub CLI is installed and signed in (`gh auth status`). Claude's shell may not have
  it on PATH — call `"C:\Program Files\GitHub CLI\gh.exe"`. Prefer `gh pr create --base main --head <branch>
  --title ... --body-file ...`.
- Fallback without `gh`: open `https://github.com/<owner>/Funation/compare/main...<branch>?expand=1&title=<url-encoded title>`
  in the built-in browser (the user is signed in to GitHub there — never type credentials; ask the user to sign in).
- Fill `textarea[name="pull_request[body]"]` via the native value setter + `input` event, then click the
  visible "Create pull request" button.
- Body sections (Korean): 요약 / 대상 (Figma · Route · Role · Domain) / 구성 / 보안 / 테스트 /
  디자인과 다르게 처리 / 미해결 (TBD), ending with the Claude Code attribution line.

## 4. Isolated test server

```bash
bash scripts/test-worktree.sh up      # prints <TEMP>/funation-test/wt-dev/apps/web
```

Add a temporary `web-isolated` entry to `.claude/launch.json`
(`npx next dev <printed path> -p 3200`), start it with the preview tools, test, then:

```bash
git checkout -- .claude/launch.json
bash scripts/test-worktree.sh down
```

Tips:
- Mock login: id `hongGD123`, password `password` (project mock data, localhost only).
- Use `form_input` / JS value setters for inputs; coordinate clicks drift under an emulated viewport.
- If the Browser pane is **hidden**, `requestAnimationFrame` pauses and streamed pages stay on
  `loading.tsx` without hydrating. Workaround in the tab:
  `window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16)`, call `$RV($RB)`
  if pending, then call `_reactRetry()` on comment nodes.
- Edits made to the main checkout while testing must be copied into the worktree (or re-run `up`).

## 5. Code conventions used so far

- Next.js 15 App Router, CSS Modules + tokens in `src/styles/tokens.css`, Gothic A1. No Tailwind.
- Mock backend behind `USE_MOCK` (`src/lib/mock.ts`); mock state on `globalThis.__funationMock*`.
  Bump the key suffix (V2 → V3) when the stored shape changes, so a running dev server does not crash.
- `"use server"` files export only async functions (and types). Client-safe types/constants live in
  sibling `*Types.ts` files; client components use `import type` from server modules.
- Every server action re-checks the session and validates input (allow-lists, ranges, lengths);
  deletes/unblocks are idempotent. Financial mutations use idempotency keys (charge, donate).
- Amounts come from the server as FN; the browser only formats them. Unknown business rules are
  marked **TBD** in code comments and PRs — never invent fees, rates, limits, refunds or schedules.
- Server actions that set cookies refresh the route; use `redirect()` for post-login screens.

## 6. Status (as of PR #36)

Done (see route-map for frame ids): home, auth, live, creators, favorites, hall of fame, support,
my page, wallet (charge + history), attendance, creator room + all donation types,
creator studio: dashboard, account settings + OBS guides, ranking, 후원위젯/알림설정 (15 widgets),
후원관리+ (5 tabs).

Remaining:
- 정산설정 — all designed screens done (`/creator/settlement`, `/register`, `/register/form`, `/apply`,
  `/manage`; frames in route-map). Not designed: 세금계산서/증빙 download (429:112 copy). Figma conflicts to keep TBD:
  minimum 10,000원 (429:4) vs 40,000 FN (466:2 · 469:195); fee 6.6% (473:2) vs per-method table (475:2);
  terms name 주식회사 투스라이프; 443:5 lists 트위치 · 치지직 (out of scope). Nav-bars 482:244 · 482:420
  belong to frames not yet located (top frame id = its workspace-wrapper id − 20).
- SOOP / FlexTV money donation (817:7552–9848, grid at x 63835/65435/67035): donation flow done
  (`/donation/[platform]`, PlatformAdapter mocks in `services/platformDonation`). 후원 내역
  (`/donation/history`) and FN Wallet (`/wallet`, 817:7552) done. Dev-only failing mocks: SOOP 게임왕, FlexTV 하트요정 (API_ERROR).
- `/terms/[slug]` body text (722:3, pending copy).
- Undesigned: 그림후원 widget popup, 10 alert-card popups, donor block entry point. 게임/크루 후원 lists are code-first (Figma T03d · T03e).
- Creator role: `Session.roles` + `getCreatorSession()` (lib/session.ts) guard every creator service; granting the role is TBD.
- Cross-cutting TBDs: widget settings ↔ donation flow (quest minimum, refunds,
  gacha odds disclosure/legal review), ranking formulas, platform event mapping.
