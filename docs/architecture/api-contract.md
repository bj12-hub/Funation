# API contract (mock → backend)

The web app talks to a **mock backend**: every call is a function in `apps/web/src/services/**`. Files marked `"use server"` are Server Actions; the others are server-only reads called from Server Components. Two route handlers live in `app/api/**`. This document is the contract the real backend has to honour, so the services can be swapped for HTTP calls without changing the UI.

Backend framework, database, payment provider and every business rule listed as **TBD** stay undecided (`docs/product/open-decisions.md`, CLAUDE.md §14).

## 1. Cross-cutting rules

| Rule | Current mock | Backend requirement |
|---|---|---|
| Mock switch | `USE_MOCK` (`lib/mock.ts`, on in `next dev` or with `NEXT_PUBLIC_AUTH_MOCK=true`). Off → services throw "… API is not connected yet." | Replace each service body with an API call; keep the signatures and result unions. |
| Session | httpOnly cookie `ssumnation_session` → `getSession()` (`lib/session.ts`) | Validate the token on every request; revoke on logout / password change. |
| Roles | `Session.roles` (`SUPPORTER` · `CREATOR` · `ADMIN`); `getCreatorSession()` guards every `services/creator/*` call | Enforce roles server-side on every endpoint (CLAUDE.md §6). How the Creator role is granted is TBD. |
| Result shape | Discriminated unions with a `status` string (e.g. `SAVED` · `INVALID` · `UNAUTHORIZED`) | Map HTTP errors onto the same statuses. `UNAUTHORIZED` = no session **or** missing role. |
| Validation | Every Server Action re-validates its input (allow-lists, ranges, lengths, formats) | Same rules on the backend; the client checks are UX only. |
| Idempotency | Money mutations take `idempotencyKey` matching `/^[A-Za-z0-9-]{16,64}$/`; same key + same request → first result, same key + different request → `CONFLICT`, still running → `IN_PROGRESS` | Persist keys with a request fingerprint; one transaction per mutation (CLAUDE.md §8). |
| Money | The browser never sends prices or computes balances, fees or net amounts; the server returns them | Balance, holds, fees, FX and payouts are authoritative on the server and every change writes an auditable ledger entry. |
| Transaction IDs | `Transaction ID` (Ssumnation) and `External Transaction ID` (payment provider / platform) are stored separately | Formats TBD. |
| Mock state | Kept on `globalThis.__ssumnationMock*`; the key suffix is bumped when a shape changes | n/a |

## 2. Money paths

| Operation | Service | Effect | Idempotency | Record |
|---|---|---|---|---|
| FN 충전 | `wallet/charge.requestCharge` | credit FN | key + fingerprint (`CONFLICT`, `IN_PROGRESS`, failures cached) | charge row |
| 크리에이터 룸 후원 | `donations/donate.requestDonation` | debit FN | key + fingerprint | donation row |
| SOOP · FlexTV 후원 | `platformDonation/platformDonation.requestPlatformDonation` | hold/debit FN → platform call → reverse on refusal; stays held on timeout (`PENDING`) | key + fingerprint | platform transaction + wallet mirror |
| 출석 보상 | `attendance.checkIn` (daily + automatic 15·30-day rewards) · `claimAttendanceReward` (3·7-day) | credit FN | natural (once per day per person / reward per month) | credit ledger (`wallet/mockCreditStore`, tagged with the account marker) |
| 정산 신청 | `creator/settlementRequests.requestSettlement` | debit creator earnings (`availableFn`) | key + amount (`CONFLICT`) | PENDING settlement request (`st-<uuid>`) with a copy of the masked registration at request time |

Not implemented anywhere yet (TBD): refunds, holds for quest/quiz outcomes, creator revenue credit from donations, platform fees, payouts, reconciliation of platform `PENDING` results.

## 3. Endpoints by domain

Legend: **R** read · **M** mutation · auth `—` none · `S` session · `C` Creator role.

### auth (`services/auth`, all Server Actions, no auth)

| Function | Input (enforced) | Result |
|---|---|---|
| `login` | identifier, password, keepSignedIn, next | `SUCCESS` · `UNKNOWN_ID` · `WRONG_PASSWORD` · `LOCKED` (5 wrong passwords per account — the identifier is trimmed, lowercased and resolved to its account first; a successful login clears the count; 2026-10-08 결정: only a password reset lifts the lock — no time-based unlock, no per-IP limit) — sets the session; old passwords (>180 days, TBD) redirect to `/login/password-change` |
| `logout` | — | redirect `/` |
| `checkEmailAvailability` · `checkNicknameAvailability` | email / nickname — the 마이페이지 nickname rules (`account/nicknameRules.ts`) | `{ available, reason? }` (`INVALID` · `FORBIDDEN` · `DUPLICATE`; advisory) |
| `signup` | email, password (8–20 with letter·digit·special — one rule for sign-up, reset and change, 2026-10-08 결정), nickname (2–12 한글/영문/숫자), `SIGNUP` phone token (used up with the account write), the agreement state as left (required ones must be true) — a sign-up while the mock's one account is active is recorded so its e-mail and nickname are taken (it cannot sign in: mock limitation) | `CREATED` · `EMAIL_TAKEN` · `NICKNAME_TAKEN` · `VERIFICATION_EXPIRED` (token unknown / used / expired / other purpose) · `INVALID` |
| `sendPhoneCode` · `verifyPhoneCode` | phone `01X-XXXX-XXXX`, purpose `SIGNUP`/`PASSWORD_RESET`, 6-digit code — accepted only if it was sent to that phone for that purpose < 180 s ago and fewer than 5 wrong codes were tried on it (the 5th wrong code invalidates it — 2026-10-08 결정, like the 180 s); a resend replaces the code | `SENT` · `PHONE_NOT_FOUND` / `VERIFIED{verificationToken}` (random, single-use, bound to phone + purpose; usable for 30 min — 2026-10-08 결정) · `INVALID_OR_EXPIRED` |
| `sendPasswordResetEmail` · `resetPassword` | email / `PASSWORD_RESET` token of the account's phone (checked first, used up with the write) + password rule, not one of the last 3 (2026-10-08 결정) | `SENT` · `EMAIL_NOT_FOUND` / `RESET` (writes the password, lifts the login lock, revokes the session) · `INVALID` · `REUSED` · `VERIFICATION_EXPIRED` |

TBD: SMS/email providers, send rate limits, age rules.

### account (`services/account`, S)

| Function | R/M | Input | Result |
|---|---|---|---|
| `getMyAccount` | R | — | profile, identity, `fnBalance` (display only), ranking visibility, connected platforms, marketing consent |
| `updateRankingVisibility` · `updateMarketingConsent` | M | key ∈ quest + boolean · boolean | `SAVED` · `FAILED` |
| `checkNickname` (no auth) · `changeNickname` · `changeSsumnationId` | R/M | format, forbidden words, 30-day interval (TBD; checked with the write). Nickname (= the default 별명, shared with sign-up): not 익명, not another member's nickname or a channel name (2026-10-08 결정), not one of the member's other 별명 | `AVAILABLE`/`CHANGED` · `INVALID` · `DUPLICATE` · `FORBIDDEN` · `LIMITED{availableFrom}` · `RESERVED` (ID only: an ID given up by a change stays reserved for 30 days, then is released — 2026-10-08 결정, value changeable) |
| `changePassword` | M | current, next (8–20, same rule as sign-up and reset), confirm, not one of last 3 | `CHANGED` (revokes the session) · `WRONG_CURRENT` · `INVALID` · `MISMATCH` · `REUSED` · `LOCKED` (wrong current passwords share the login's per-account count; at 5 the account locks and the session is revoked) |
| `uploadProfilePhoto` | M | jpeg/png/webp ≤ 5 MB | `UPLOADED{avatarUrl}` · `UNSUPPORTED` · `TOO_LARGE` · `FAILED` |
| `linkLoginProvider` · `unlinkLoginProvider` | M | NAVER / GOOGLE / KAKAO | `LINKED` · `UNLINKED` · `INVALID` |
| `verifyIdentity` | M | PHONE / IPIN | `VERIFIED` · `ALREADY_VERIFIED` · `DUPLICATE` · `LOCKED` |
| `connectPlatform` · `disconnectPlatform` | M | YOUTUBE / FLEXTV / SOOP, account id, ownership code `FN-XXXX-XXXX` | `CONNECTED{handle}` · `INVALID_CODE` · `DISCONNECTED` |

TBD: OAuth hand-off, identity provider, platform ownership verification, whether the last login method can be unlinked.

### wallet (`services/wallet`, S)

| Function | R/M | Input | Result |
|---|---|---|---|
| `getChargeOptions` · `quoteCharge` | R | amount 1,000–999,999,999 | packages, methods, balance · `OK{fnAmount, price}` / `INVALID{minAmount}` |
| `agreeChargeTerms` | M | guardian, privacy, payment = true | `AGREED` · `INVALID` |
| `requestCharge` | M | package or custom amount, method, **idempotencyKey** | `COMPLETED{transactionId, fnAmount, price, balance}` · `FAILED{code}` · `IN_PROGRESS` · `CONFLICT` · `INVALID` · `TERMS_REQUIRED` |
| `getWalletSummary` · `getChargeHistory` · `getDonationHistory` | R | period, category, page (10) | summary · paged records |
| `getWalletOverview` | R | kind ∈ CHARGE/USE/REFUND/REWARD, period 30/90/all, page | available, locked (0, TBD), totalUsed, ledger entries (also FORFEIT rows of 남은 FN 정리, under 전체 only) |
| `GET /api/wallet/charges` · `GET /api/wallet/donations` | R | period (+ category) | CSV download, 401 without a session |
| `quoteChargeRefund` (`refund.ts`) | R | chargeId | `QUOTE{type FULL_CANCEL/PARTIAL/NOT_REFUNDABLE, chargeFn, paidKrw, usedFn, withinPeriod, grossFn, feeFn, netFn, refundKrw}` · the existing request · `INVALID` |
| `requestChargeRefund` (`refund.ts`) | M | chargeId, reason ≤ 200, expectedGrossFn · expectedNetFn (what the member saw) | the request `{status, requestedAt, amounts{type, grossFn, feeFn, netFn, refundKrw}, requestedAmounts?}` (one per charge) · `CHANGED{quote}` · `NOT_REFUNDABLE{quote}` · `INVALID` |

Charge refunds follow the 환불 정책 기본값 (일반적인 기준, 법무 검토 전 — docs/domains/wallet.md); `refundKrw` (2026-10-08 결정) is the KRW refund: a 전액 취소 the whole paid amount, otherwise net FN ÷ the charge's FN × its paid KRW, rounded down to the won — server-computed, stored with the request (`quote`) and the approval (`settled`). The admin approval (`POST /api/admin/refunds/[chargeId]`, `decision`, `note`, `expectedGrossFn` · `expectedNetFn` for APPROVE) recomputes it. `POST /api/admin/refunds/[chargeId]/hold` (`action` HOLD | RELEASE, `note`, `requestId`) puts a waiting request on 보류, which stops 승인 · 거절 until 보류 해제; a member's 이용 정지 does not stop either (2026-10-08 결정). A suspended member keeps their FN; for a 영구 정지 member `GET /api/admin/members/[id]` adds `fnSettlement` (남은 FN 정리: status READY / EMPTY / BLOCKED / NO_LEDGER, per-charge lines, totals, forfeited free FN, history) and `POST /api/admin/members/[id]/fn-settlement` (`note`, `requestId`, `expectedGrossFn` · `expectedNetFn` · `expectedRefundKrw` · `expectedForfeitFn`) refunds the paid FN per charge, forfeits the free FN and zeroes the balance — once per request id, refused while a refund request of the member waits or is on 보류, audited `MEMBER_FN_SETTLE` (docs/domains/wallet.md "이용 정지와 남은 FN"). TBD: payment provider, FN packages, FN price (mock `×1.1`), limits, expiry, how each payment method pays a KRW refund out, a reconciled ledger with balance-after.

### donations (`services/donations/donate.requestDonation`, S)

One Donation Core for every type (CLAUDE.md §10). Common input: `idempotencyKey`, `creatorId`, `hideProfile`, `type`. Prices for SIGNATURE / WISHLIST / GACHA and the ROULETTE minimum come from the server catalog (the 룰렛 · 뽑기 widget settings).

| Type | Enforced input | Amount charged |
|---|---|---|
| TEXT · MINI · VIDEO | ≥ 1,000 / ≥ 100 / ≥ 1,000; message ≤ 100 / text ≤ 30; YouTube URL + range | amount |
| AUDIO (음성 후원, 2026-10-08) | ≥ 1,000 FN (decided 2026-10-08, same as VIDEO); YouTube URL + range 0 … 24 h, terms); queued with the videos as `mode: AUDIO`, played as sound in a small visible player on `/overlay/video` | amount |
| SIGNATURE · WISHLIST | catalog id (in stock) + message ≤ 100 | catalog price |
| ROULETTE | 룰렛 on; amount ≥ 최소 참여 금액; 1인 하루 횟수 | amount (one spin; the result is drawn at payment) |
| GACHA | enabled 뽑기, not sold out; 확률 안내 동의; 1인 횟수 한도 | 뽑기 price (the prize is drawn at payment) |
| QUEST | title ≤ 50; success ≥ 1,000; time ≤ 3,600 s (failed or canceled = full refund) | success reward |
| DRAWING | PNG ≤ 400 KB chars | amount |

Result: `COMPLETED{donationId, fnAmount, balance}` · `INSUFFICIENT_FN{balance, required}` · `IN_PROGRESS` · `CONFLICT` · `INVALID` · `NOT_FOUND` · `UNAUTHORIZED`. TBD: revenue share, fees, refunds other than quests, overlay delivery. LUCKYBOX and QUIZ_* were removed (2026-10-04).

### platformDonation (`services/platformDonation`, S)

| Function | R/M | Input | Result |
|---|---|---|---|
| `getPlatformHome` · `searchPlatformCreators` · `getPlatformCreatorDetail` | R | platform SOOP/FLEXTV, query ≤ 40, creatorId | balance, creators, products (server prices) |
| `quotePlatformDonation` | R | platform, creatorId, productId, customFn (bounds) | `OK{priceFn, balance, afterFn, sufficient}` · `INVALID` · `NOT_FOUND` · `UNAVAILABLE` |
| `requestPlatformDonation` | M | + message ≤ 100, **idempotencyKey** | `COMPLETED{transactionId, externalTransactionId, …}` · `PENDING` · `FAILED{reason}` · `INSUFFICIENT_FN` · `IN_PROGRESS` · `CONFLICT` · `INVALID` |
| `getDonationHistory` (`donationHistory.ts`) | R | tab all/soop/flextv/direct, period, status, q, tx | merged history + selected detail |

Platform access goes through `PlatformAdapter` (`adapters.ts`, CLAUDE.md §9). TBD: FN ↔ platform-currency rate, fees, whether each platform lets Ssumnation send 별풍선/하트 on a user's behalf, auth, reconciliation, refunds.

### creator studio (`services/creator`, C)

| File | Functions | Notes |
|---|---|---|
| `creatorStudio.ts` | `getCreatorProfile`, `getCreatorDashboard(period ≤ 366 days)` | revenue in KRW from the server (gross vs net TBD) |
| `creatorRanking.ts` | `getCreatorRanking(type, period, query ≤ 20, page)` | scoring/season/tie rules TBD |
| `creatorSettings.ts` | settings read, live-profile / languages / main platform / SNS, integration key reveal / reissue, channel name, profile, images | reissue must revoke old integrations + audit (TODO) |
| `donationManagement.ts` | page settings, slug, one-line message, banned words, received donations, donor ranking, filters, block list, title tiers | all `SAVED`/`INVALID{message}`; deletes are idempotent |
| `widgetSettings.ts` | 16 widget details/saves (incl. `ALERT` 후원 알림 디자인 — theme · layout · headline with {닉네임} · switches · motion · countUp; `getOverlayAlert` returns it with the resolved theme), custom sounds (≤ 20, mp3/wav/ogg ≤ 2 MB; `getOverlayAlert` sends `customSounds` {word, url, volume} and the audio comes from `GET /api/custom-sound/[id]`, mock CDN), wallpapers (≤ 10) | GACHA odds / legal review TBD |
| `widgetOverlay.ts` | `getOverlayWidget(widget, integrationKey)` — no login, the key is the credential (`FORBIDDEN` otherwise); widgets: goal · total · ranking · recent · event · qr · quest · vote · roulette · gacha · gacha-board · wallpaper · clock · mini | mini = latest 미니후원 (`donationType` `MINI` on the alert feed) ≥ 최소 표시 금액, newest first, at most 5 (code-first) |
| `overlayTheme.ts` | 오버레이 테마: channel 전체 테마 (`BOLD` · `PILL` · `GLASS`) + 포인트 색상 (#RRGGBB or null = theme default), get/save; overlays read it with their widget's own choice (`INHERIT` = 전체 테마) | — |
| `settlement.ts` | overview, `acceptSettlementTerms` (4 required), overseas answers, `registerSettlement` (multipart, per-type required fields/files) | ID numbers validated then discarded; masked account only |
| `settlementRequests.ts` | apply view, `quoteSettlement`, `requestSettlement` (**idempotencyKey**), auto settlement | all four need a registration (`NOT_REGISTERED`) then 본인인증 (`IDENTITY_REQUIRED`, 2026-10-06 결정); mock policy = Figma samples (min 40,000 FN, fee 6.6 %, 1 FN = 1원) — all TBD |
| `settlementManagement.ts` | manage view (period filter), `resetSettlementRegistration` | archive old registration for audit (TODO) |

### Public reads (no auth)

`creators/creators` (`getCreators`, `getCreatorById`), `creators/creatorRoom.getCreatorRoom`, `home/homeFeed.getHomeFeed`, `live/liveChannels`, `hallOfFame/supporterRanking`, `support/faq.getFaqs` (answers null until policies exist), `favorites.getFavoritesPromotion`.

### favorites · attendance · events · votes (S)

- `getFavorites` · `addFavorite` (idempotent) · `removeFavorite` · `isFavorite` — 2026-10-08 결정: a suspended creator is left out of `getFavorites` (items, `totalCount`, pages) while suspended, by the same check that hides it from the public screens; the stored entry stays, so it is listed again once the suspension ends. `addFavorite` answers `NOT_FOUND` for it meanwhile.
- `events.getEvents` · `getEvent` · `joinEvent` (idempotent, only while running) and `votes.getRoomVote` · `castVote` — 2026-10-08 결정: once per event / per vote per person, keyed by the phone verified at sign-up like 출석 (a 재가입 with the same phone shows 참여함 / 내 투표 and cannot add another). Responses carry counts and the viewer's own state only.
- `getAttendance` · `checkIn` · `claimAttendanceReward` — 2026-10-08 결정: the 15·30-day rewards are paid automatically by the check-in that reaches them (`CHECKED_IN.autoPaid`, a REWARD wallet record each, once per month) and are never `CLAIMABLE`; only 3·7 are claimed. One check-in per day per person, keyed by the phone verified at sign-up (a same-day 재가입 with the same phone gets `ALREADY_CHECKED_IN`); a 재가입 account otherwise starts with no progress or rewards (state and credits carry the account marker). Reward amounts and time zone TBD.

## 4. Known gaps to close with the backend

- Server-side audit log for every setting change and money movement.
- Refund, chargeback and reconciliation flows (`REFUNDING` / `REFUNDED` exist only as display states).
- Rate limiting (login, SMS, search) and abuse prevention.
- Real file storage for uploads (the mock keeps data URLs or file names only).
