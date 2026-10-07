# API contract (mock → backend)

The web app talks to a **mock backend**: every call is a function in `apps/web/src/services/**`. Files marked `"use server"` are Server Actions; the others are server-only reads called from Server Components. Two route handlers live in `app/api/**`. This document is the contract the real backend has to honour, so the services can be swapped for HTTP calls without changing the UI.

Backend framework, database, payment provider and every business rule listed as **TBD** stay undecided (`docs/product/open-decisions.md`, CLAUDE.md §14).

## 1. Cross-cutting rules

| Rule | Current mock | Backend requirement |
|---|---|---|
| Mock switch | `USE_MOCK` (`lib/mock.ts`, on in `next dev` or with `NEXT_PUBLIC_AUTH_MOCK=true`). Off → services throw "… API is not connected yet." | Replace each service body with an API call; keep the signatures and result unions. |
| Session | httpOnly cookie `funation_session` → `getSession()` (`lib/session.ts`) | Validate the token on every request; revoke on logout / password change. |
| Roles | `Session.roles` (`SUPPORTER` · `CREATOR` · `ADMIN`); `getCreatorSession()` guards every `services/creator/*` call | Enforce roles server-side on every endpoint (CLAUDE.md §6). How the Creator role is granted is TBD. |
| Result shape | Discriminated unions with a `status` string (e.g. `SAVED` · `INVALID` · `UNAUTHORIZED`) | Map HTTP errors onto the same statuses. `UNAUTHORIZED` = no session **or** missing role. |
| Validation | Every Server Action re-validates its input (allow-lists, ranges, lengths, formats) | Same rules on the backend; the client checks are UX only. |
| Idempotency | Money mutations take `idempotencyKey` matching `/^[A-Za-z0-9-]{16,64}$/`; same key + same request → first result, same key + different request → `CONFLICT`, still running → `IN_PROGRESS` | Persist keys with a request fingerprint; one transaction per mutation (CLAUDE.md §8). |
| Money | The browser never sends prices or computes balances, fees or net amounts; the server returns them | Balance, holds, fees, FX and payouts are authoritative on the server and every change writes an auditable ledger entry. |
| Transaction IDs | `Transaction ID` (Funation) and `External Transaction ID` (payment provider / platform) are stored separately | Formats TBD. |
| Mock state | Kept on `globalThis.__funationMock*`; the key suffix is bumped when a shape changes | n/a |

## 2. Money paths

| Operation | Service | Effect | Idempotency | Record |
|---|---|---|---|---|
| FN 충전 | `wallet/charge.requestCharge` | credit FN | key + fingerprint (`CONFLICT`, `IN_PROGRESS`, failures cached) | charge row |
| 크리에이터 룸 후원 | `donations/donate.requestDonation` | debit FN | key + fingerprint | donation row |
| SOOP · FlexTV 후원 | `platformDonation/platformDonation.requestPlatformDonation` | hold/debit FN → platform call → reverse on refusal; stays held on timeout (`PENDING`) | key + fingerprint | platform transaction + wallet mirror |
| 출석 보상 | `attendance.checkIn` · `claimAttendanceReward` | credit FN | natural (once per day / reward) | credit ledger (`wallet/mockCreditStore`) |
| 정산 신청 | `creator/settlementRequests.requestSettlement` | debit creator earnings (`availableFn`) | key + amount (`CONFLICT`) | PENDING settlement request (`st-<uuid>`) with a copy of the masked registration at request time |

Not implemented anywhere yet (TBD): refunds, holds for quest/quiz outcomes, creator revenue credit from donations, platform fees, payouts, reconciliation of platform `PENDING` results.

## 3. Endpoints by domain

Legend: **R** read · **M** mutation · auth `—` none · `S` session · `C` Creator role.

### auth (`services/auth`, all Server Actions, no auth)

| Function | Input (enforced) | Result |
|---|---|---|
| `login` | identifier, password, keepSignedIn, next | `SUCCESS` · `UNKNOWN_ID` · `WRONG_PASSWORD` · `LOCKED` (5 wrong passwords per account — the identifier is trimmed, lowercased and resolved to its account first; a successful login clears the count, a password reset lifts the lock; lock expiry TBD, per-IP counting is the backend's) — sets the session; old passwords (>180 days, TBD) redirect to `/login/password-change` |
| `logout` | — | redirect `/` |
| `checkEmailAvailability` · `checkNicknameAvailability` | email / nickname formats | `{ available }` (advisory) |
| `signup` | email, password (8+ with letter·digit·special), nickname (2–12 한글/영문/숫자), phone token, required agreements | `CREATED` · `EMAIL_TAKEN` · `NICKNAME_TAKEN` · `INVALID` |
| `sendPhoneCode` · `verifyPhoneCode` | phone `01X-XXXX-XXXX`, purpose `SIGNUP`/`PASSWORD_RESET`, 6-digit code (180 s) | `SENT` · `PHONE_NOT_FOUND` / `VERIFIED{verificationToken}` · `INVALID_OR_EXPIRED` |
| `sendPasswordResetEmail` · `resetPassword` | email / token + password rule | `SENT` · `EMAIL_NOT_FOUND` / `RESET` · `INVALID` |

TBD: SMS/email providers, rate and attempt limits, token validation, age rules.

### account (`services/account`, S)

| Function | R/M | Input | Result |
|---|---|---|---|
| `getMyAccount` | R | — | profile, identity, `fnBalance` (display only), ranking visibility, connected platforms, marketing consent |
| `updateRankingVisibility` · `updateMarketingConsent` | M | key ∈ quest/luckyBox/play + boolean · boolean | `SAVED` · `FAILED` |
| `checkNickname` (no auth) · `changeNickname` · `changeFunationId` | R/M | format, forbidden words, 30-day interval (TBD) | `AVAILABLE`/`CHANGED` · `INVALID` · `DUPLICATE` · `FORBIDDEN` · `LIMITED{availableFrom}` |
| `changePassword` | M | current, next (8–20), confirm, not one of last 3 | `CHANGED` (revokes the session) · `WRONG_CURRENT` · `INVALID` · `MISMATCH` · `REUSED` · `LOCKED` (wrong current passwords share the login's per-account count; at 5 the account locks and the session is revoked) |
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
| `getWalletOverview` | R | kind ∈ CHARGE/USE/REFUND/REWARD, period 30/90/all, page | available, locked (0, TBD), totalUsed, ledger entries |
| `GET /api/wallet/charges` · `GET /api/wallet/donations` | R | period (+ category) | CSV download, 401 without a session |

TBD: payment provider, FN packages, FN/KRW rate (mock `×1.1`), limits, expiry, refunds, a reconciled ledger with balance-after.

### donations (`services/donations/donate.requestDonation`, S)

One Donation Core for every type (CLAUDE.md §10). Common input: `idempotencyKey`, `creatorId`, `hideProfile`, `type`. Prices for SIGNATURE / WISHLIST / GACHA and the ROULETTE minimum come from the server catalog (the 룰렛 · 뽑기 widget settings).

| Type | Enforced input | Amount charged |
|---|---|---|
| TEXT · MINI · VIDEO | ≥ 1,000 / ≥ 100 / ≥ 1,000; message ≤ 100 / text ≤ 30; YouTube URL + range | amount |
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

Platform access goes through `PlatformAdapter` (`adapters.ts`, CLAUDE.md §9). TBD: FN ↔ platform-currency rate, fees, whether each platform lets Funation send 별풍선/하트 on a user's behalf, auth, reconciliation, refunds.

### creator studio (`services/creator`, C)

| File | Functions | Notes |
|---|---|---|
| `creatorStudio.ts` | `getCreatorProfile`, `getCreatorDashboard(period ≤ 366 days)` | revenue in KRW from the server (gross vs net TBD) |
| `creatorRanking.ts` | `getCreatorRanking(type, period, query ≤ 20, page)` | scoring/season/tie rules TBD |
| `creatorSettings.ts` | settings read, live-profile / languages / main platform / SNS, integration key reveal / reissue, channel name, profile, images | reissue must revoke old integrations + audit (TODO) |
| `donationManagement.ts` | page settings, slug, one-line message, banned words, received donations, donor ranking, filters, block list, title tiers | all `SAVED`/`INVALID{message}`; deletes are idempotent |
| `widgetSettings.ts` | 15 widget details/saves, custom sounds (≤ 20, mp3/wav/ogg ≤ 2 MB), wallpapers (≤ 10) | GACHA odds / legal review TBD |
| `settlement.ts` | overview, `acceptSettlementTerms` (4 required), overseas answers, `registerSettlement` (multipart, per-type required fields/files) | ID numbers validated then discarded; masked account only |
| `settlementRequests.ts` | apply view, `quoteSettlement`, `requestSettlement` (**idempotencyKey**), auto settlement | all four need a registration (`NOT_REGISTERED`) then 본인인증 (`IDENTITY_REQUIRED`, 2026-10-06 결정); mock policy = Figma samples (min 40,000 FN, fee 6.6 %, 1 FN = 1원) — all TBD |
| `settlementManagement.ts` | manage view (period filter), `resetSettlementRegistration` | archive old registration for audit (TODO) |

### Public reads (no auth)

`creators/creators` (`getCreators`, `getCreatorById`), `creators/creatorRoom.getCreatorRoom`, `home/homeFeed.getHomeFeed`, `live/liveChannels`, `hallOfFame/supporterRanking`, `support/faq.getFaqs` (answers null until policies exist), `favorites.getFavoritesPromotion`.

### favorites · attendance (S)

- `getFavorites` · `addFavorite` (idempotent) · `removeFavorite` · `isFavorite`
- `getAttendance` · `checkIn` · `claimAttendanceReward` — reward amounts, monthly reset and time zone TBD.

## 4. Known gaps to close with the backend

- Server-side audit log for every setting change and money movement.
- Refund, chargeback and reconciliation flows (`REFUNDING` / `REFUNDED` exist only as display states).
- Rate limiting (login, SMS, search) and abuse prevention.
- Real file storage for uploads (the mock keeps data URLs or file names only).
