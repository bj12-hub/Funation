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

- **Original spec (read-only):** 펀페이 file `PXOl6e2HQVWsu9qx9iagJV` (single page `0:1`, too large for
  `get_metadata` on the page — walk node ids). Never write to it.
- **Writable since 2026-10:** "Somnation — 현재 구현 (2026-09)" `PMnjPwrD3nAiItJxjaZ0qj` (pages 1–6 are
  screenshots of the built screens; page "9 스튜디오" and "10 사이트" hold editable auto-layout frames) and
  "Somnation Admin" `Js5MCzkGmAZ9QY0w3nLUe8`. Frame ids per screen: `docs/figma/site-design-system.md`,
  `docs/figma/route-map.md`. Write only to these two files.
- Editable frames are drawn from the running app: a headless walk of the page produces a layout tree, and
  the renderers stored in the file (`figma.root.getSharedPluginData("ssumnation", "renderer")` for studio,
  `"siteRenderer"` for site) build the frame. Mask overlay / integration keys (`6138-····-····-····`) and
  use fictional names before writing.
- Tools: `get_screenshot`, `get_design_context` (skillNames `resource:figma-design-to-code`), `get_metadata` on frames.
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
   `bash scripts/merge-pr.sh <pr> <branch> "<title>"` (tsc + eslint + vitest + next build for apps/web and
   apps/admin in a throwaway worktree, push main, merge main → preview).
7. Return the checkout to preview:
   `git fetch -q origin && git switch -q preview && git merge -q --ff-only origin/preview`
8. Report to the user in Korean: what was built, what differs from Figma, TBD items, next step.

The user runs `npm run dev:sync` on port 3000 (tracks `origin/preview`). Do not start a second dev
server on that checkout; use the isolated worktree instead.

## 3. Pull requests

- Since 2026-09-29 the GitHub CLI is installed and signed in (`gh auth status`). Claude's shell may not have
  it on PATH — call `"C:\Program Files\GitHub CLI\gh.exe"`. Prefer `gh pr create --base main --head <branch>
  --title ... --body-file ...`.
- Fallback without `gh`: open `https://github.com/<owner>/Ssumnation/compare/main...<branch>?expand=1&title=<url-encoded title>`
  in the built-in browser (the user is signed in to GitHub there — never type credentials; ask the user to sign in).
- Fill `textarea[name="pull_request[body]"]` via the native value setter + `input` event, then click the
  visible "Create pull request" button.
- Body sections (Korean, CLAUDE.md §13): 목적 / Figma / 라우트 · 역할 · 도메인 / 변경 / 테스트 / 미결 (TBD),
  ending with the Claude Code attribution line.

## 4. Running the app for checks

- `.claude/launch.json` has `web` (`npm run dev:web`, port 3100, next free port if taken) and `admin`
  (`npm run dev:admin`, port 3200). Start them with the preview tools. The admin app reads the site through
  `SITE_API_URL=http://localhost:3100` (`apps/admin/.env.local`), so keep the site on 3100 when checking admin.
- Both run in the main checkout. Only use them while the user's `dev:sync` (port 3000) is not running —
  two dev servers on one `apps/web/.next` break each other. Otherwise use the isolated worktree:

```bash
bash scripts/test-worktree.sh up      # prints <TEMP>/ssumnation-test/wt-dev/apps/web
# temporary launch.json entry: npx next dev <printed path> -p <free port>
git checkout -- .claude/launch.json
bash scripts/test-worktree.sh down
```

- Mock state lives in server memory (`globalThis.__ssumnationMock*`): restarting a dev server resets it.

Tips:
- Mock login: id `hongGD123`, password `password` (project mock data, localhost only).
- Use `form_input` / JS value setters for inputs; coordinate clicks drift under an emulated viewport.
- If the Browser pane is **hidden**, `requestAnimationFrame` pauses and streamed pages stay on
  `loading.tsx` without hydrating. Workaround in the tab:
  `window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16)`, call `$RV($RB)`
  if pending, then call `_reactRetry()` on comment nodes.
- Edits made to the main checkout while testing must be copied into the worktree (or re-run `up`).
- Known dev-only noise (2026-10-08): opening `/creator/settlement/register/form` without accepted terms redirects to
  `/creator/settlement/register` from inside the `/creator` loading boundary, and `next dev` logs "Rendered more hooks
  than during the previous render" with a stack that is entirely React / Next.js router code. The redirect is correct and
  a production build is clean, so smoke runs list it as expected. (The same pattern broke `/channel/new` in production —
  fixed in #225 by removing that route's loading boundary — so re-check with `next build && next start` if a new
  redirect under a loading boundary shows it.)

## 5. Code conventions used so far

- Next.js 15 App Router, CSS Modules + tokens in `src/styles/tokens.css`, Gothic A1. No Tailwind.
- Mock backend behind `USE_MOCK` (`src/lib/mock.ts`); mock state on `globalThis.__ssumnationMock*`.
  Bump the key suffix (V2 → V3) when the stored shape changes, so a running dev server does not crash.
- `"use server"` files export only async functions (and types). Client-safe types/constants live in
  sibling `*Types.ts` files; client components use `import type` from server modules.
- Every server action re-checks the session and validates input (allow-lists, ranges, lengths);
  deletes/unblocks are idempotent. Financial mutations use idempotency keys (charge, donate).
- Amounts come from the server as FN; the browser only formats them. Unknown business rules are
  marked **TBD** in code comments and PRs — never invent fees, rates, limits, refunds or schedules.
- Server actions that set cookies refresh the route; use `redirect()` for post-login screens.
- Money paths (2026-10-06 audit, #226–#233): ids that records are looked up by use `randomUUID()`, never a
  timestamp; anything read before an `await` is read again after it, and the check and the write sit in one
  synchronous block; secrets from a request (admin token, overlay key, manager token, bank-SMS key) go through
  `lib/secret.ts` `sameSecret`; allow-list checks on input use `Object.hasOwn`, never `in`. A record shown to
  the member is built from an explicit field list (no `{ ...r }` spreads of server records).
- Account lifecycle: withdrawal ends everything that acts for the channel (manager links, chat / YouTube
  connections, overlay and bank-SMS keys, settlement registration); a 재가입 starts without the old consents,
  settlement history, earnings or notifications, and the withdrawn account's posts, comments, blocks and reports move
  to its own `…-wN` member id. New per-account state needs the same treatment in `withdrawal.ts` / `rejoin.ts`.
  Retention (2026-10-08, 기본값 — 법무 검토 전): periods live only in `account/retentionPolicy.ts`; a withdrawn
  account's data goes at its date in `account/retentionPurge.ts` (lazy, on console reads and sign-up). New personal
  data either goes at withdrawal or gets a category there.
- Parallel work in worktrees: link `node_modules` with a junction (`New-Item -ItemType Junction` when
  `cmd /c mklink` is blocked) and remove only the junction before deleting the worktree.

## 6. Status

Current status lives in the docs, not here: routes and frames in `docs/figma/route-map.md`, code-first
features and their TBDs in `docs/figma/code-first-screens.md`, the funnation comparison in
`docs/research/funnation-reference.md`. The notes below are the original PR #36 snapshot, kept for the
Figma conflicts they record.

### Snapshot (PR #36)

Done (see route-map for frame ids): home, auth, live, creators, favorites, hall of fame, support,
my page, wallet (charge + history), attendance, creator room + all donation types,
creator studio: dashboard, account settings + OBS guides, ranking, 후원위젯/알림설정 (15 widgets),
후원관리+ (5 tabs).

Remaining:
- 정산설정 — all designed screens done (`/creator/settlement`, `/register`, `/register/form`, `/apply`,
  `/manage`; frames in route-map). Not designed: 세금계산서/증빙 download (429:112 copy). Figma conflicts to keep TBD:
  minimum 10,000원 (429:4) vs 40,000 FN (466:2 · 469:195); fee 6.6% (473:2) vs per-method table (475:2);
  terms name 주식회사 투스라이프; 443:5 lists 트위치 (out of scope) and 치지직 (confirmed 2026-10-01, in the 사용채널 list). Nav-bars 482:244 · 482:420
  belong to frames not yet located (top frame id = its workspace-wrapper id − 20).
- SOOP / FlexTV money donation (817:7552–9848, grid at x 63835/65435/67035): donation flow done
  (`/donation/[platform]`, PlatformAdapter mocks in `services/platformDonation`). 후원 내역
  (`/donation/history`) and FN Wallet (`/wallet`, 817:7552) done. Dev-only failing mocks: SOOP 게임왕, FlexTV 하트요정 (API_ERROR).
- `/terms/[slug]` body text (722:3, pending copy).
- Undesigned: 그림후원 widget popup, 10 alert-card popups, donor block entry point. 게임/크루 후원 lists are code-first (Figma T03d · T03e).
- Creator role: `Session.roles` + `getCreatorSession()` (lib/session.ts) guard every creator service; granting the role is TBD.
- Cross-cutting TBDs: widget settings ↔ donation flow (quest minimum, refunds,
  gacha odds disclosure/legal review), ranking formulas, platform event mapping.
