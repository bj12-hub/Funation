# API contract (mock → backend)

The web app talks to a **mock backend**: every call is a function in `apps/web/src/services/**`. Files marked `"use server"` are Server Actions; the others are server-only reads called from Server Components. Two route handlers live in `app/api/**`. This document is the contract the real backend has to honour, so the services can be swapped for HTTP calls without changing the UI.

Backend framework, database, payment provider and every business rule listed as **TBD** stay undecided (`docs/product/open-decisions.md`, CLAUDE.md §14).

2026-10-25: the backend is **FLEXTV's existing API**, connected area by area (`docs/development/flextv-backend.md`). Phase 1 — `auth`, the session and 간편 로그인 — and phase 2 — the wallet's balance, charge (`requestCharge` also answers `PAYMENT_STARTED` · `DEPOSIT_REQUESTED` · `NOT_ELIGIBLE`, read on with `checkChargeStatus`), 충전 내역 and FN Wallet — phase 3 — `requestDonation` to a FLEXTV channel id (일반 · 시그니처) and 후원 내역 — and phase 4 — `getAllLiveChannels`, the room's stream and `getRoomChat` · `sendRoomChat` — and phase 5 — `becomeStreamer`, 방송 설정 (`getBroadcastView` · `revealStreamKey` · `changeStreamEngine` · `startBroadcast` · `updateBroadcast` · `stopBroadcast`), the studio's `getCreatorProfile` · `getCreatorDashboard` · `getDashboardSummary` · `getRevenueOverview` (amounts with a `unit`, FN on FLEXTV) and 정산 as FLEXTV's 환전 (`getFlextvSettlementView` · `requestExchange` with an Idempotency-Key, answering `IN_PROGRESS` while FLEXTV's answer is unclear · `getExchangeHistory` · `cancelExchange`) — and phase 6 — `requestDonation`'s 영상 후원 on a FLEXTV channel (priced by the second through `catalog.mediaPricing`) and, with `FLEXTV_SSUMNATION_API=on`, 미니 · 위시리스트 · 그림 · 룰렛 · 뽑기 · 퀘스트 with `getRoomRoulette` · `getRoomGacha`, `decideMyQuest` · `decideReceivedQuest`, the 리모컨's `getQuestRemote` · `extendQuestTime` · roulette and gacha actions (`getFlextvRemote`, `reissueFlextvOverlayKey`), `getOverlayWidget` for 룰렛 · 뽑기 · 당첨 리스트 · 퀘스트 · 미니 (`getOverlayAlert` is not served), and 후원 내역's 퀘스트 · 게임 tabs (the contract FLEXTV implements: `docs/development/flextv-ssumnation-api.md`) — and phase 7 — 마이페이지 (`getFlextvMyAccount`; `checkNickname` · `changeNickname` · `uploadProfilePhoto` · `changePassword` on FLEXTV, no `changeSsumnationId`), 즐겨찾기 (`getFavorites` · `isFavorite` · `addFavorite`, which may answer `NEEDS_VERIFICATION`, · `removeFavorite` by FLEXTV channel id), 알림 (`getUnreadCount` 1 or 0, items with `createdAt: null`, kind `LIVE`), `getCreators` and `getHomeFeed` from FLEXTV's channels, 고객센터 (`getNotices` · `getNotice` · `getFaqs` · `listMyInquiries`; `submitInquiry` refused) and 채널 설정 (`getFlextvChannelSettings` · `checkFlextvChannelName` · `saveFlextvChannelName` · `saveFlextvChannelDescription` · `uploadFlextvChannelBanner` · `saveFlextvChannelLinks`), the pages without a FLEXTV backend not served (`lib/flextv/siteRoutes.ts`) — and phase 8 — with `FLEXTV_SSUMNATION_API=on`, `getOverlayAppearance` · `saveOverlayAppearance` and `getWidgetDetail` · `saveWidgetSettings` for 퀘스트 · 미니 · 룰렛 · 뽑기 on FLEXTV's overlay design document (the look only; `live.designOnly`; contract §10) — and phase 9 — 쪽지 (`getMailbox` inbox · sent, `sendMessage` to a 아이디, `markMessageRead`, `deleteMessages`, `blockMessageSender`; `moveMessages` refused) and its 차단 (`listBlocks` · `unblock` by 아이디), the room's 소식 · 팬 랭킹 (`getFlextvChannelNews` · `getFlextvChannelRanking`, amounts null), 채팅 관리 (`getFlextvChatSettings`, `saveFlextvChatText`, `addFlextvBanWord` · `removeFlextvBanWord`, `addFlextvChatMember` · `removeFlextvChatMember` by 아이디, `saveFlextvYoutubeLink` · `removeFlextvYoutubeLink` · `showFlextvYoutubeChat`), `submitFlextvInquiry` (multipart, with a request id; `submitInquiry` refused), 이벤트 (`getFlextvEvents` · `getFlextvEvent`) and 명예의 전당 (`getFlextvHallOfFame`) — call FLEXTV when `NEXT_PUBLIC_BACKEND=flextv`; the sections below stay the contract of the mock and of the areas not connected yet.

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
| FN 충전 | `wallet/charge.requestCharge` | credit FN — only to the account that made it while still active; in progress (회원 탈퇴 refused) until the provider answers or a 처리중 charge is confirmed (2026-10-10 결정, `wallet/chargeCore.ts`) | key per member + fingerprint (`CONFLICT`, `IN_PROGRESS`, failures cached) | charge row; a payment completed after its account withdrew credits nobody and is kept for the console (`uncreditedCharges`, 완료 · FN 미지급) |
| 처리 중 충전 결정 | `admin/pendingCharges.resolvePendingCharge` (console) | 결제 확인: credit the 처리중 charge's FN (not to a withdrawn account — 완료 · FN 미지급); 결제 취소: nothing, and one "FN 충전이 취소됐어요" notification while the account is active (2026-10-12 결정 · 2026-10-13, via `confirmChargePayment`) | console request id + same charge · outcome · memo, once per charge | decision record (`admin/pendingChargeCore.ts`) + audit `PENDING_CHARGE_RESOLVE` |
| 크리에이터 룸 후원 | `donations/donate.requestDonation` | debit FN | key + fingerprint | donation row |
| SOOP · FlexTV 후원 | `platformDonation/platformDonation.requestPlatformDonation` | hold/debit FN → platform call → reverse on refusal; stays held on timeout (`PENDING`) → re-checked for 24 h, then decided in the console; 실패 returns the FN (not to a withdrawn sender) | key per member + fingerprint (the adapter gets a derived key, `platformKey.ts`); console decision by request id | platform transaction + wallet mirror (처리중 → 완료 / REFUNDED with `fnReturned`, shown as FN 반환) |
| 이벤트 보상 | `admin/events.payEventReward` (참여자 전원 무상 FN) | credit free FN to each participant's current account | once per event (console request id), per person | credit ledger (`wallet/mockCreditStore`, "이벤트 보상 · …") + `EVENT_REWARD_PAY` audit |
| 출석 보상 | `attendance.checkIn` (daily + automatic 15·30-day rewards) · `claimAttendanceReward` (3·7-day) | credit FN — on its way until paid (회원 탈퇴 refused meanwhile), then only to the account it is for while still active; otherwise not paid (2026-10-10 결정, `wallet/inFlightCore.ts`) | natural (once per day per person / reward per month) | credit ledger (`wallet/mockCreditStore`, tagged with the account marker) |
| 정산 신청 | `creator/settlementRequests.requestSettlement` | debit creator earnings (`availableFn`) | key + amount (`CONFLICT`) | PENDING settlement request (`st-<uuid>`) with a copy of the masked registration at request time |

Not implemented anywhere yet (TBD): refunds, holds for quest/quiz outcomes, creator revenue credit from donations, platform fees, payouts.

## 3. Endpoints by domain

Legend: **R** read · **M** mutation · auth `—` none · `S` session · `C` Creator role.

### auth (`services/auth`, all Server Actions, no auth)

| Function | Input (enforced) | Result |
|---|---|---|
| `login` | identifier, password, keepSignedIn, next, `cancelWithdrawal?` | `SUCCESS` · `UNKNOWN_ID` · `WRONG_PASSWORD` · `LOCKED` (5 wrong passwords per account — the identifier is trimmed, lowercased and resolved to its account first; a successful login clears the count; 2026-10-08 결정: only a password reset lifts the lock — no time-based unlock, no per-IP limit) · `SUSPENDED` · `WITHDRAWAL_PENDING{effectiveAt}` (2026-11-02, 회원탈퇴 유예: the right password for an account whose 탈퇴 신청 is waiting — no session; the same sign-in with `cancelWithdrawal: true` removes the request and goes on as usual, a suspension still answering `SUSPENDED`; from `effectiveAt` on the account has withdrawn → `UNKNOWN_ID`) — sets the session; old passwords (>180 days, TBD) redirect to `/login/password-change` |
| `logout` | — | redirect `/` |
| `checkEmailAvailability` · `checkNicknameAvailability` | email / nickname — the 마이페이지 nickname rules (`account/nicknameRules.ts`) | `{ available, reason? }` (`INVALID` · `FORBIDDEN` · `DUPLICATE`; advisory) |
| `signup` | email, password (8–20 with letter·digit·special — one rule for sign-up, reset and change, 2026-10-08 결정), nickname (2–12 한글/영문/숫자), `SIGNUP` phone token (used up with the account write), the agreement state as left (required ones must be true) — a sign-up while the mock's one account is active is recorded so its e-mail and nickname are taken (it cannot sign in: mock limitation); an account whose 탈퇴 신청 is waiting still exists, so its e-mail and nickname stay taken until the 탈퇴 takes effect (2026-11-02) | `CREATED` · `EMAIL_TAKEN` · `NICKNAME_TAKEN` · `VERIFICATION_EXPIRED` (token unknown / used / expired / other purpose) · `INVALID` |
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
| `getWithdrawalInfo` · `withdrawAccount` (`withdrawal.ts`) | R/M | — / **requestId**, consents, the amounts shown (`fnBalance`, `unsettledFn`), password (shares the login's failure count) | info (balance, 정산 대기 수익, what holds the 탈퇴) / `REQUESTED{effectiveAt}` (2026-11-02, 회원탈퇴 유예 — FLEXTV 기준: the request is stored and the session revoked; the 탈퇴 takes effect exactly 30 days later, when `withdrawalApply.ts` forfeits the FN and earnings of that moment and deletes the personal data; the same requestId answers the same, also after it took effect; another one → `UNAUTHORIZED`) · `INVALID{message}` · `REFUND_PENDING` · `QUEST_PENDING` · `PLATFORM_PENDING` · `CHARGE_PENDING` · `ATTENDANCE_PENDING` · `WRONG_PASSWORD` · `LOCKED` · `UNAUTHORIZED` (docs/domains/wallet.md "회원 탈퇴") |

TBD: OAuth hand-off, identity provider, platform ownership verification, whether the last login method can be unlinked.

### wallet (`services/wallet`, S)

| Function | R/M | Input | Result |
|---|---|---|---|
| `getChargeOptions` · `quoteCharge` | R | amount 1,000–999,999,999 | packages, methods, balance · `OK{fnAmount, price}` / `INVALID{minAmount}` |
| `agreeChargeTerms` | M | guardian, privacy, payment = true | `AGREED` · `INVALID` |
| `requestCharge` | M | package or custom amount, method, **idempotencyKey** (per member) | `COMPLETED{transactionId, fnAmount, price, balance}` · `FAILED{code}` · `IN_PROGRESS` · `CONFLICT` · `INVALID` · `TERMS_REQUIRED` · `UNAUTHORIZED` (also: the account withdrew before the provider call, or before the payment completed — then nothing is credited) |
| `getWalletSummary` · `getChargeHistory` · `getDonationHistory` | R | period, category, page (10) | summary · paged records |
| `getWalletOverview` | R | kind ∈ CHARGE/USE/REFUND/REWARD, period 30/90/all, page | available, locked (0, TBD), totalUsed, ledger entries (also FORFEIT rows of 남은 FN 정리, under 전체 only) |
| `GET /api/wallet/charges` · `GET /api/wallet/donations` | R | period (+ category) | CSV download, 401 without a session |
| `quoteChargeRefund` (`refund.ts`) | R | chargeId | `QUOTE{type FULL_CANCEL/PARTIAL/NOT_REFUNDABLE, chargeFn, paidKrw, usedFn, withinPeriod, grossFn, feeFn, netFn, refundKrw}` · the existing request · `INVALID` |
| `requestChargeRefund` (`refund.ts`) | M | chargeId, reason ≤ 200, expectedGrossFn · expectedNetFn (what the member saw) | the request `{status, requestedAt, amounts{type, grossFn, feeFn, netFn, refundKrw}, requestedAmounts?}` (one per charge) · `CHANGED{quote}` · `NOT_REFUNDABLE{quote}` · `INVALID` |

Charge refunds follow the 환불 정책 기본값 (플렉스티비 기준, 법무 검토 전 — docs/domains/wallet.md); `refundKrw` (2026-10-08 결정) is the KRW refund: a 전액 취소 the whole paid amount, otherwise net FN ÷ the charge's FN × its paid KRW, rounded down to the won — server-computed, stored with the request (`quote`) and the approval (`settled`). The admin approval (`POST /api/admin/refunds/[chargeId]`, `decision`, `note`, `expectedGrossFn` · `expectedNetFn` for APPROVE) recomputes it. `POST /api/admin/refunds/[chargeId]/hold` (`action` HOLD | RELEASE, `note`, `requestId`) puts a waiting request on 보류, which stops 승인 · 거절 until 보류 해제; a member's 이용 정지 does not stop either (2026-10-08 결정, kept 2026-11-02). A suspended member keeps their FN; for a 영구 정지 member `GET /api/admin/members/[id]` adds `fnSettlement` (남은 FN 정리: status READY / EMPTY / BLOCKED / NO_LEDGER, per-charge lines, totals, forfeited free FN, history) and `POST /api/admin/members/[id]/fn-settlement` (`note`, `requestId`, `expectedGrossFn` · `expectedNetFn` · `expectedRefundKrw` · `expectedForfeitFn`) refunds the paid FN per charge, forfeits the free FN and zeroes the balance — once per request id, refused while a refund request of the member waits or is on 보류, or while FN are on their way to the member (a charge in progress — provider call or 처리중 — or an 출석 보상 not paid yet, the same rule as 회원 탈퇴; `fnSettlement.blockedBy` REFUND | CHARGE | ATTENDANCE says which, checked again in the step that writes), audited `MEMBER_FN_SETTLE` (docs/domains/wallet.md "이용 정지와 남은 FN"). 처리 중 충전 (2026-10-12 결정): `GET /api/admin/pending-charges` lists every account's 처리중 charges (`waiting`, oldest first: `chargeId`, `chargedAt`, `methodLabel`, `fnAmount`, `paidAmount`, `transactionId`, member + `memberWithdrawn`) and the console's decisions (`resolved`, newest first, with `resolution{outcome, result, at, operator, note}`); `POST /api/admin/pending-charges/[chargeId]/resolve` (`outcome` COMPLETED = 결제 확인 | CANCELLED = 결제 취소, `note` 2–200, `requestId`) answers `{ status: "OK", result: CREDITED | NOT_CREDITED | CANCELLED }` (also for a retry with the same charge, outcome and memo; anything else under that id is "잘못된 요청입니다."), refused once the charge is no longer 처리중 ("이미 처리된 충전이에요 (완료 | 결제 취소)."). A charge confirmed later counts in the refund FIFO from its confirmation, and `GET /api/admin/payments` gives each refund request's `charge` its `confirmedAt` (결제 확인 일시, the site's zone-less stamp like `chargedAt`; null for a charge paid with its request), where its 청약철회 period starts. TBD: payment provider, FN packages, FN price (mock `×1.1`), limits, expiry, how each payment method pays a KRW refund out, a reconciled ledger with balance-after.

### donations (`services/donations/donate.requestDonation`, S)

One Donation Core for every type (CLAUDE.md §10). Common input: `idempotencyKey`, `creatorId`, `hideProfile`, `type`. Prices for SIGNATURE / WISHLIST / GACHA and the ROULETTE minimum come from the server catalog (the 룰렛 · 뽑기 widget settings).

| Type | Enforced input | Amount charged |
|---|---|---|
| TEXT · MINI · VIDEO | ≥ 1,000 / 100 … 999 (under 1,000, decided 2026-10-09; `catalog.maxAmount.MINI`) / ≥ 1,000; message ≤ 100 / text ≤ 30; YouTube URL + range | amount |
| AUDIO (음성 후원, 2026-10-08) | ≥ 1,000 FN (decided 2026-10-08, same as VIDEO); YouTube URL + range 0 … 24 h, terms); queued with the videos as `mode: AUDIO`, played as sound in a small visible player on `/overlay/video` | amount |
| SIGNATURE · WISHLIST | catalog id (in stock) + message ≤ 100 | catalog price |
| ROULETTE | 룰렛 on; amount ≥ 최소 참여 금액; 1인 하루 횟수 | amount (one spin; the result is drawn at payment) |
| GACHA | enabled 뽑기, not sold out; 확률 안내 동의; 1인 횟수 한도 | 뽑기 price (the prize is drawn at payment) |
| QUEST | title ≤ 50; success ≥ 1,000; time ≤ 3,600 s (failed or canceled = full refund) | success reward |
| DRAWING | PNG ≤ 400 KB chars | amount |

Result: `COMPLETED{donationId, fnAmount, balance}` · `INSUFFICIENT_FN{balance, required}` · `IN_PROGRESS` · `CONFLICT` · `INVALID` · `NOT_FOUND` · `UNAUTHORIZED` (no session, or the account withdrew before the debit — also when a 재가입 account took the slot meanwhile; nothing debited). TBD: revenue share, fees, refunds other than quests, overlay delivery. LUCKYBOX and QUIZ_* were removed (2026-10-04).

### platformDonation (`services/platformDonation`, S)

| Function | R/M | Input | Result |
|---|---|---|---|
| `getPlatformHome` · `searchPlatformCreators` · `getPlatformCreatorDetail` | R | platform SOOP/FLEXTV, query ≤ 40, creatorId | balance, creators, products (server prices) |
| `quotePlatformDonation` | R | platform, creatorId, productId, customFn (bounds) | `OK{priceFn, balance, afterFn, sufficient}` · `INVALID` · `NOT_FOUND` · `UNAVAILABLE` |
| `requestPlatformDonation` | M | + message ≤ 100, **idempotencyKey** | `COMPLETED{transactionId, externalTransactionId (null when an operator decided 성공), …}` · `PENDING` · `FAILED{reason}` (nothing debited) · `FAILED{RESULT_FAILED, transactionId, fnReturned}` (a PENDING donation that failed after the hold — FN 반환, or forfeited for a withdrawn sender) · `INSUFFICIENT_FN` · `IN_PROGRESS` · `CONFLICT` · `INVALID` · `UNAUTHORIZED` (no session, or the account withdrew before the hold — also when a 재가입 account took the slot meanwhile; nothing held) — a PENDING key sent again re-checks the platform first and answers the result once known |
| `getDonationHistory` (`donationHistory.ts`) | R | tab all/soop/flextv/direct, period, status, q, tx | merged history + selected detail; re-checks this account's PENDING donations inside their 24 h first (`getWithdrawalInfo`, the 회원 탈퇴 screen, and `withdrawAccount`, its 탈퇴 button, do the same) |

Platform access goes through `PlatformAdapter` (`adapters.ts`, CLAUDE.md §9; `lookupDonation` asks for the result of an earlier send). PENDING results (2026-10-08 결정, docs/domains/integrations.md): the console reads `GET /api/admin/platform-donations` (`waiting` 확인 필요 · `resolved` · `checking`; re-checks those inside 24 h), `POST /api/admin/platform-donations/[transactionId]/check` (다시 확인 → `{ status: "OK", outcome: COMPLETED | FAILED | UNKNOWN }`) and `POST …/resolve` (`outcome` COMPLETED | FAILED, `note` 2–200, `requestId`; refused inside 24 h or once settled). `GET /api/admin/donations` (후원 운영, `?status=` a donation status or `FN_RETURNED`) marks a failed one's returned FN `fnReturned` and counts it under `byStatus.FN_RETURNED`, apart from `REFUNDED` (real refunds only — 2026-10-09 결정). TBD: FN ↔ platform-currency rate, fees, whether each platform lets Ssumnation send 별풍선/하트 on a user's behalf, auth, real status lookups, refunds.

### creator studio (`services/creator`, C)

| File | Functions | Notes |
|---|---|---|
| `creatorStudio.ts` | `getCreatorProfile`, `getCreatorDashboard(period ≤ 366 days)` | revenue in KRW from the server (gross vs net TBD) |
| `creatorRanking.ts` | `getCreatorRanking(type, period, query ≤ 20, page)` | scoring/season/tie rules TBD |
| `creatorSettings.ts` | settings read, live-profile / languages / main platform / SNS, integration key reveal / reissue, channel name, profile, images | reissue must revoke old integrations + audit (TODO) |
| `donationManagement.ts` | page settings, slug, one-line message, banned words, received donations, donor ranking, filters, block list, title tiers | all `SAVED`/`INVALID{message}`; deletes are idempotent |
| `donationImport.ts` (내역 이관, 2026-10-16 기본값 — TBD) | see "donation import" below | imported records live in their own store; no FN, wallet, earnings, settlement, 등급 · 칭호 or FN ranking effect |
| `widgetSettings.ts` | 16 widget details/saves (incl. `ALERT` 후원 알림 디자인 — theme · layout · headline with {닉네임} · switches · motion · countUp; `getOverlayAlert` returns it with the resolved theme), custom sounds (≤ 20, mp3/wav/ogg ≤ 2 MB; `getOverlayAlert` sends `customSounds` {word, url, volume} and the audio comes from `GET /api/custom-sound/[id]`, mock CDN), wallpapers (≤ 10) | GACHA odds / legal review TBD |
| `widgetOverlay.ts` | `getOverlayWidget(widget, integrationKey)` — no login, the key is the credential (`FORBIDDEN` otherwise); widgets: goal · total · ranking · recent · event · qr · quest · vote · roulette · gacha · gacha-board · wallpaper · clock · mini | mini = latest 미니후원 (`donationType` `MINI` on the alert feed) ≥ 최소 표시 금액, newest first, at most 5 (code-first) |
| `overlayTheme.ts` | 오버레이 테마: channel 전체 테마 (`BOLD` · `PILL` · `GLASS`) + 포인트 색상 (#RRGGBB or null = theme default), get/save; overlays read it with their widget's own choice (`INHERIT` = 전체 테마) | — |
| `settlement.ts` | overview, `acceptSettlementTerms` (4 required), overseas answers, `registerSettlement` (multipart, per-type required fields/files) | ID numbers validated then discarded; masked account only |
| `settlementRequests.ts` | apply view, `quoteSettlement`, `requestSettlement` (**idempotencyKey**), auto settlement | all four need a registration (`NOT_REGISTERED`) then 본인인증 (`IDENTITY_REQUIRED`, 2026-10-06 결정); mock policy = Figma samples (min 40,000 FN, fee 6.6 %, 1 FN = 1원) — all TBD |
| `settlementManagement.ts` | manage view (period filter), `resetSettlementRegistration` | archive old registration for audit (TODO) |

### donation import (`services/creator/donationImport.ts`, C — docs/domains/donation-import.md)

Every action needs the Creator role (`UNAUTHORIZED` / `null` otherwise — also for a suspended or withdrawn creator) and writes in
one synchronous step after its last await, for the account it started with. Limits are sample values (TBD).

| Function | R/M | Input (enforced) | Result |
|---|---|---|---|
| `getDonationImportOverview` | R | — | `batches` (newest first, `ImportBatchView`: source, createdAt, fileName / channelHandle, rows, imported, invalid, duplicates, totals per unit, `ACTIVE` / `UNDONE`), `totals` per source, `flextv` (`supported`, `unverified`, `linked`, `lastSyncAt`, `lastResult`, `lastError`) |
| `previewToonationCsv` | M | FormData `file`: `.csv` / `.txt` / `.tsv`, ≤ 5 MB, UTF-8 · UTF-16 (BOM) · CP949, ≤ 20,000 data rows, ≤ 50 columns | `OK{preview}` (previewId, fileName, encoding, headers, mapping, missing, detected, sample, totals, first 20 rows, ≤ 100 problem rows, expiresAt — kept 30 min) · `INVALID{code, message}` (`NO_FILE` · `NOT_CSV` · `SPREADSHEET` · `TOO_LARGE` · `EMPTY` · `NO_DATA` · `TOO_MANY_ROWS` · `TOO_MANY_COLUMNS` · `ENCODING` · `MALFORMED`) |
| `remapToonationCsv` | M | `previewId` (own, this account, in time), `mapping` (column index or null per field; distinct, in range) | `OK{preview}` · `INVALID{EXPIRED | BAD_MAPPING}` |
| `importToonationCsv` | M | `previewId`, `mapping` (required fields set), **`requestId`** `/^[A-Za-z0-9-]{16,64}$/` (per member) | `IMPORTED{batch}` · `NOTHING_TO_IMPORT{invalid, duplicates}` · `IN_PROGRESS` · `CONFLICT` (same id, other preview or mapping) · `INVALID{BAD_REQUEST | BAD_MAPPING | EXPIRED}`; a retry gets the first result |
| `undoDonationImport` | M | `batchId` | `UNDONE{removed}` (records removed for good; again → `removed: 0`) · `NOT_FOUND` |
| `syncFlexTvDonations` | M | — (the linked FlexTV account) | `OK{imported, duplicates, skipped, hasMore, syncedAt}` · `FAILED{code TIMEOUT | UNAVAILABLE | UNAUTHORIZED | NOT_FOUND | CHANNEL_CHANGED, message, counts kept before the failure}` · `NOT_LINKED` · `UNSUPPORTED` · `IN_PROGRESS` (one sync at a time) |
| `getImportedDonations` | R | `source` all/toonation/flextv, `from` / `to` (KST days, optional), `q` ≤ 20, `page` (20) | page of records (at, source, donorName, message, kind, amount, unit), totals per unit, `hasAny` |
| `exportImportedDonationsCsv` | R | same filters | `OK{filename, csv, rows, truncated}` (≤ 20,000 rows, UTF-8 BOM, formula-looking cells prefixed with `'`) |

Dedupe: 투네이션 rows by a fingerprint (SHA-256 of source · time · nickname · amount · message hash), FlexTV by External
Transaction ID. `PlatformAdapter.fetchReceivedDonations(channel, { cursor, since })` (capability `DONATION_HISTORY`, FlexTV only,
unverified). The 수단별 보드 (`getOverlayWidget("ranking")` with board SOURCE) adds "투네이션 이관" / "FlexTV 이관" rows from
source · unit · amount · time only. 회원 탈퇴 deletes the records, batches, previews and the FlexTV position (the count-only trail
stays). TBD: the real 투네이션 export format, FlexTV's history API, retention while active, the backend audit store.

### Public reads (no auth)

`creators/creators` (`getCreators`, `getCreatorById`), `creators/creatorRoom.getCreatorRoom`, `home/homeFeed.getHomeFeed`, `live/liveChannels`, `hallOfFame/supporterRanking`, `support/faq.getFaqs` (answers null until policies exist), `favorites.getFavoritesPromotion`.

### favorites · attendance · events · votes (S)

- `getFavorites` · `addFavorite` (idempotent) · `removeFavorite` · `isFavorite` — 2026-10-08 결정: a suspended creator is left out of `getFavorites` (items, `totalCount`, pages) while suspended, by the same check that hides it from the public screens; the stored entry stays, so it is listed again once the suspension ends. `addFavorite` answers `NOT_FOUND` for it meanwhile.
- `events.getEvents` · `getEvent` · `joinEvent` (idempotent, only while running) and `votes.getRoomVote` · `castVote` — 2026-10-08 결정: once per event / per vote per person, keyed by the phone verified at sign-up like 출석 (a 재가입 with the same phone shows 참여함 / 내 투표 and cannot add another). Responses carry counts and the viewer's own state only.
- 이벤트 보상 (2026-10-08 결정, docs/domains/events.md): `getEvent` adds `reward` (`FREE_FN{amountFn}` · `DRAW{winners, prize}` or null → the TBD `rewardNote`), `outcome` (`FREE_FN{at}` · `DRAW{at, winners: masked nicknames}`) and `myResult` (`PAID{amountFn}` on the credited account · `WON` · `NOT_WON`). Console: `GET /api/admin/events`, `POST /api/admin/events/[id]/reward` (`kind`, `amountFn` 1–10,000,000 or `winners` 1–1,000 + `prize` 2–100자 — sanity bounds; same reward again = no change), `POST …/pay` · `POST …/draw` (`requestId`; only after the event ended, once per event; audited `EVENT_REWARD_SET` · `EVENT_REWARD_PAY` · `EVENT_DRAW`).
- `getAttendance` · `checkIn` · `claimAttendanceReward` — 2026-10-08 결정: the 15·30-day rewards are paid automatically by the check-in that reaches them (`CHECKED_IN.autoPaid`, a REWARD wallet record each, once per month) and are never `CLAIMABLE`; only 3·7 are claimed. One check-in per day per person, keyed by the phone verified at sign-up (a same-day 재가입 with the same phone gets `ALREADY_CHECKED_IN`); a 재가입 account otherwise starts with no progress or rewards (state and credits carry the account marker). Reward amounts and time zone TBD.

## 4. Known gaps to close with the backend

- Server-side audit log for every setting change and money movement.
- Refund, chargeback and reconciliation flows (`REFUNDING` / `REFUNDED` exist only as display states).
- Rate limiting (login, SMS, search) and abuse prevention.
- Real file storage for uploads (the mock keeps data URLs or file names only).
