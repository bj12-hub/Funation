# Platform Integrations

Confirmed (CHZZK added 2026-10-01):

```text
PlatformAdapter
├── YouTubeAdapter
├── FlexTVAdapter
├── SoopAdapter
└── ChzzkAdapter
```

Adapters isolate external API authentication, DTOs, events, errors and capability differences.

The core donation domain must not depend directly on external platform SDK types.

Code: `apps/web/src/services/platforms/adapters.ts` (adapters), `platformTypes.ts` (core types),
`mockBroadcastRemote.ts` (mock platforms with their own DTO shapes).

## Capabilities

Callers check `adapter.capabilities`; nothing assumes every platform can do the same thing.
`adapter.unverified` lists capabilities the mock declares but the real API is not confirmed for yet —
screens show them as 「확인 중」.

| Capability | YouTube | 치지직 | SOOP | FlexTV |
|---|---|---|---|---|
| CHANNEL_PROFILE | ✓ | 확인 중 | 확인 중 | 확인 중 |
| VIDEO_LIST | ✓ | — | — | — |
| LIVE_STATUS | ✓ | ✓ | ✓ | ✓ |
| DONATION_EVENTS | ✓ (슈퍼챗) | 확인 중 (치즈) | 확인 중 (별풍선) | 확인 중 (단위 TBD) |
| CHAT_EVENTS (읽기) | ✓ | 확인 중 | 확인 중 | 확인 중 |
| CHAT_SEND (보내기) | ✓ | 확인 중 | — | — |
| CHAT_MODERATE (삭제 · 차단) | ✓ | — | — | — |

YouTube rows follow the YouTube Data API (liveChatMessages list/insert/delete, liveChatBans insert).
Authentication for every platform (OAuth / login) is TBD.

## 유튜브 연동 · 영상 목록 (`services/creator/youtube.ts`)

- Sync reads the latest page (50) and then re-checks, by id (`findVideos`, 50 ids per call, at most 200 per
  sync — the ones confirmed longest ago first), the stored videos that are not on it.
- **유튜브에서 지운 영상 표시 (2026-10-08 결정)**: a video YouTube no longer shows (deleted or private) is kept
  with its 표시 / 고정 settings and listed as 「찾을 수 없음」 in `/creator/videos`; it cannot be newly pinned.
  A video that comes back is unmarked. The channel page's 영상 탭 lists what YouTube returns, so it never
  shows such a video. Pruning old entries is TBD.
- A sync whose channel was disconnected, replaced or withdrawn during the platform calls writes nothing.
- Lookups by a client-sent video or request id read own entries only (`lib/records.ts` `ownEntry`), so
  `__proto__` or `propertyIsEnumerable` never reach Object.prototype.

## Reading platform feeds (chat and donation events)

- **Cursor per channel**: the read position is stored with the channel id it belongs to. No cursor, or
  one for another channel, means "start from now": that read only takes the current position, nothing is
  replayed. This also covers a first read that failed and a poll that runs while a channel is connecting.
- `onChannelChanged(platform)` (`chatCore.ts`) runs in the same tick as every channel change — YouTube
  connect/disconnect, 채널 연결/해제, a switch to another channel, account withdrawal. It drops the chat
  and 후원 연동 cursors and switches that platform's 후원 연동 off until the creator turns it on again.
  Withdrawal also clears the chat feed. A read that returns after its channel changed is discarded.
- **Failure isolation**: each platform is read separately with a timeout (5 s) and its own try/catch.
  A failure or hang is recorded as that platform's `lastError` (shown on its row); the others, and the
  rest of the screen (e.g. 계좌 후원 on 후원 연동), keep working.
- **Validation in the adapter**: every DTO is checked (id, time, amount, text). A malformed item is
  dropped and counted (`skipped`) and the cursor moves past it, so it can never block later items.
  Unknown badges/grades map to no role.
- **Amounts** (`toAmount`): a positive number or plain digit string up to 10,000,000 in the platform's
  own unit (a sanity bound, not a business rule); whole numbers for 치즈 · 별풍선; YouTube amounts are
  whole micros with an ISO currency. "1,000", negatives, NaN and other formats are rejected, not guessed.

## 통합 채팅 (unified chat)

- `services/broadcast/chatCore.ts` merges every connected platform's chat into one feed.
- Messages are deduped by `${platform}:${externalMessageId}` (reconnects re-deliver messages).
- A newly connected channel starts from "now"; the backlog is not replayed.
- One platform failing (timeout, outage) never blocks the others; its error shows on its row.
- **Hide** is Ssumnation-only and works for every platform (the overlay stops showing the message).
- **Delete** and **ban** act on the platform, and only where CHAT_MODERATE is declared.
- **Send** (통합 입력) posts to every chosen platform with CHAT_SEND and reports the result per platform.
  `requestId` makes retries deterministic: a retry only re-attempts the platforms that definitely failed
  (FAILED). Platforms are claimed (PENDING) before the platform call, so a concurrent call with the same
  `requestId` never posts twice. A timeout may have posted the message: it is reported as UNCONFIRMED
  (「확인 필요」) and not resent automatically — the creator checks the chat (looking the message up on
  the platform is TBD).
- Forbidden words are auto-hidden (`FILTER`).
- Channel connections: `services/broadcast/channelsCore.ts`. YouTube reuses 유튜브 연동; the others
  connect by channel id in the mock.

## 통합 후원 알림 (unified donation alerts)

- Every platform's donation events go through `services/creator/donationLink.ts` into the **one**
  alert queue (`alertCore.ts`). Alerts play one at a time, never at once.
- Each platform event is deduped by `${platform}:${externalEventId}`.
- Amounts stay in the platform's own unit: KRW/USD 슈퍼챗, 치즈, 별풍선, FlexTV TBD. They are never
  converted to FN, and they create no wallet, earnings or settlement records.
- **Unit codes** (`types/donationUnit.ts`, 2026-10-08): the adapter maps each platform's unit to a stable code, so the
  core and the stores never key anything by a display label. Screens show the label; renaming a label orphans nothing.

  | Code | Label | From |
  | --- | --- | --- |
  | `FN` | FN | Ssumnation donations |
  | `KRW` · `USD` · `JPY` | 원 · USD · JPY | YouTube 슈퍼챗 (ISO 4217; KRW also 계좌 후원) |
  | `SOOP_BALLOON` | 별풍선 | SOOP |
  | `CHZZK_CHEESE` | 치즈 | CHZZK |
  | `FLEXTV_UNIT` | FlexTV 후원 | FlexTV (unit name TBD, placeholder) |

  A Super Chat in another ISO currency keeps its ISO code: shown and summed on 수단별 보드, but not a 자동엑셀 unit.
  Data saved by label before the codes (자동엑셀 환산값, 후원 리스트 entries, alert `native.currency`) is mapped to the
  code when read, and actions still accept a label from an older screen.
- Events are pulled when 후원 연동 opens or polls, and by the alert overlay read (at most every 2 s —
  mock transport only; production receives them through the live connection, TBD).
- Turning a platform on starts from "now". Platforms whose DONATION_EVENTS is unverified show
  「API 확인 중」 on 후원 연동.

## 플랫폼 후원 (FN → SOOP · FlexTV, `services/platformDonation`)

- The FN is held before the platform call. A refusal reverses the hold ("FN은 차감되지 않았습니다.").
- A platform call that throws or does not answer in time (10 s, sample value) has an unknown outcome:
  the FN stays held, the transaction stays PROCESSING and the Idempotency-Key answers **PENDING** with
  its Transaction ID (the client shows 「처리 결과 확인 중」 and the ID). The hold gets its wallet record at once
  (FN 후원내역 처리중).
- **결과 확인 (2026-10-08 결정, `pendingCore.ts`)**: for 24 hours after the request the server asks the platform for the
  result (`PlatformAdapter.lookupDonation`, by Idempotency-Key and Transaction ID; 5 s timeout and at most once a minute
  per transaction — sample values). It asks lazily: when 후원 내역 is read and when the 회원 탈퇴 screen opens or 탈퇴 is
  pressed (that account's donations, `recheckAccountPending`), when the same key is sent again (「결과 다시 확인」) and
  when the console list is read. A lookup that fails or times out is "no result yet".
  - COMPLETED: the donation completes as a direct success (External Transaction ID from the platform).
  - FAILED: the held FN goes back with a wallet record; 후원 내역 shows 실패 with 「SOOP 확인 결과 실패 · FN 반환」. FN 내역
    (2026-10-09 결정 — it is not a refund): the hold reads 「FN 반환」 (not 환불완료) in FN 후원내역, its CSV and the FN Wallet
    list, plus an 「FN 반환 · SOOP 별풍선 10개」 (+) row of its own type 「FN 반환」 (chip and filter `?kind=RETURN`, not under
    환불; `walletTypes.donationStatusLabel` · `LEDGER_KIND_LABEL.RETURN`, record flag
    `fnReturned`). Real refunds (퀘스트 실패 · 취소, 충전 환불) keep 환불완료. The console's 후원 운영 (`/donations`,
    `GET /api/admin/donations`) shows it as 「FN 반환」 too (row `fnReturned`), with its own 「FN 반환」 tile and
    `?status=FN_RETURNED` filter; the 환불완료 tile and filter count real refunds only (2026-10-09 결정).
  - The same key then answers COMPLETED / FAILED instead of PENDING. A FAILED here came after the hold, so it answers
    `FAILED{reason: RESULT_FAILED, transactionId, fnReturned}` — never the "nothing was debited" reasons: the donation
    flow's 「결과 다시 확인」 shows 「후원에 실패했습니다.」 · 「후원 결과가 실패로 확인되었습니다.」 · 「보류된 FN은
    반환되었습니다.」 (no FN line when it was forfeited), not 「FN은 차감되지 않았습니다.」.
  - Check and write: the answers are applied in one synchronous step after the last await, only to a transaction still
    pending.
- **확인 중 후원 (console, after 24 hours)**: still no result → listed in the admin console (`/donations/pending`, 대시보드
  처리 대기). The operator presses 다시 확인 (asks the platform now, audited `PLATFORM_DONATION_CHECK`) or decides 성공 /
  실패 with a required memo (2–200자): once per console request id, refused once settled or inside the 24 hours, audited
  `PLATFORM_DONATION_RESOLVE`. 성공 keeps the FN spent (no external id); 실패 returns it (「운영자 확인 결과 실패 · FN 반환」).
- **Withdrawn sender**: when the account that sent it has withdrawn since (also after a 재가입 in the same slot), a 실패
  credits nothing — the return is recorded as forfeited (반환 불가(탈퇴), 「확인 결과 실패 · 탈퇴한 계정이라 FN 반환 불가(소멸)」),
  like the rest of a withdrawn account's FN, and the console says so before and after the decision.
- **Withdrawal waits (2026-10-09 결정)**: while a 플랫폼 후원 of the account is PENDING, 회원 탈퇴 is refused
  (`PLATFORM_PENDING`, checked again with the write after the password check), like 충전 환불 · 퀘스트. A donation whose
  platform call is still running (FN held, another tab) counts too (`pendingCore.awaitsResult`): a refusal would put its
  FN back into the slot after the 탈퇴. The 탈퇴 screen shows
  a card with the count and a link to 후원 내역. Opening the screen re-checks the account's PENDING donations first, as
  후원 내역 does (inside the 24 h, at most once a minute each), so a result that has come in unblocks it. Pressing 탈퇴
  (`withdrawAccount`) re-checks the same way before its PENDING check (2026-10-09 결정): a result that came in after the
  screen opened lets the withdrawal go through in that request (a failure's returned FN is checked against the FN
  consent like any changed amount). The final PENDING check and the write stay one synchronous step after the last
  await. (A withdrawn sender can still exist: an account that withdrew before this rule, or the console settling one
  after it.)
- **사이트 알림 (2026-10-09 결정)**: a settled PENDING donation — by a re-check or an operator — notifies the member once
  (dedupe key `platform-pending:<Transaction ID>`), only while the account that sent it is active (never a withdrawn one):
  「확인 중이던 후원이 완료됐어요」 · 「SOOP · 김스트리머님께 10,000 FN」, or 「확인 중이던 후원이 실패했어요」 ·
  「… · FN 반환」, linking to `/donation/history?period=all&tx=<Transaction ID>`.
- The member keeps seeing 처리중 and 「처리 결과 확인 중」 in 후원 내역 until a result, then 완료 or 실패 · FN 반환.
- TBD: whether each real platform has a status lookup, its rate limits; push · e-mail for the result.
- A failure before the hold finishes the key as FAILED (nothing debited), so a retry never sees
  IN_PROGRESS forever.

## TBD

- Transport: the mock reads on demand (studio/overlay polls). Production needs a live connection per
  platform (YouTube polling with quota; CHZZK/SOOP/FlexTV sockets) and a push channel to overlays.
- Per-creator feeds and queues (the mock has one creator), persistence, rate limits.
- Matching one person across platforms, and moderator accounts.
