# FLEXTV ↔ Ssumnation API (6단계 · 썸네이션 전용 후원, 8단계 · 오버레이 디자인)

Status: **contract, front first** (2026-10-25). Ssumnation's side is built against it (`apps/web/src/lib/flextv/ssumnation.ts`,
`ssumnationBroadcast.ts`, `overlayDesign.ts` for §10) and tested with a stand-in; FLEXTV implements it next. Until
FLEXTV serves it, Ssumnation keeps it off (`FLEXTV_SSUMNATION_API` unset) and a FLEXTV channel offers FLEXTV's own types
only.

Ssumnation's screens offer donation types FLEXTV has no endpoint for: **미니 · 위시리스트 · 그림 · 룰렛 · 뽑기 · 퀘스트**,
with their broadcast control (Ssumnation's 리모컨 and OBS overlays) and their place in the supporter's 후원 내역 (영상
후원 needs nothing new — it goes through FLEXTV's `POST /api/luv/send` YouTube effect, priced by the streamer's 도우미
setting from `GET /api/luv/effect-settings`). This document is what FLEXTV adds.

## Conventions

- Base path `/api/ssumnation` on FLEXTV's API server. Member routes take the member's Bearer token (as every other call
  Ssumnation makes) and sit behind FLEXTV's member-only gate; `caller` comes from the token only. "The streamer" means
  the caller's own channel — never a channel id from the request.
- Ssumnation calls from its server only, with the member's `X-Forwarded-For` and `User-Agent`.
- Amounts are whole 렉스. Ids are strings of `[A-Za-z0-9_-]{1,40}` unless said otherwise. Times are ISO 8601 (UTC).
- Every answer is JSON with a `status`. Messages meant for the member are Korean, short (≤ 100 characters), and never
  carry internal detail (SQL, stack traces, keys).
- The 렉스 move through FLEXTV's existing ledger (the same debit procedure as `/api/luv/send`), so 잔액, 받은 렉스, 정산
  and 후원 내역 keep working as they do.
- Names shown on stream (donors, titles, 미니 text) have FLEXTV's forbidden words applied.

## 1. A channel's settings — `GET /api/ssumnation/channels/:channelId/donation-settings`

Public (no token). What the streamer turned on; a type that is off is `null` or empty. 404 = the channel has none.

```json
{
  "mini": { "enabled": true, "minAmount": 100, "maxAmount": 999, "maxLength": 30,
            "colors": [{ "id": "pink", "label": "핑크", "hex": "#FF5CA8" }] },
  "wishlist": [{ "id": "w1", "emoji": "🎧", "name": "헤드셋", "price": 30000, "note": "", "inStock": true }],
  "game": { "minAmount": 1000, "maxTitle": 50 },
  "drawing": { "enabled": true },
  "quest": { "enabled": true, "maxTimeSec": 3600, "allowExtension": true },
  "roulette": { "enabled": true, "minAmount": 1000, "dailyLimit": 0,
                "items": [{ "name": "노래 한 곡", "percent": 30 }, { "name": "꽝", "percent": 70 }] },
  "gacha": [{ "id": "g1", "name": "행운 뽑기", "price": 3000, "mode": "PROBABILITY",
              "prizes": [{ "name": "꽝", "blank": true, "percent": 50, "left": null }, { "name": "사인", "blank": false, "percent": 50, "left": null }],
              "limit": 2, "soldOut": false }]
}
```

- `game` is shared by 그림 and 퀘스트, as in Ssumnation: their minimum and the title length. `quest.maxTimeSec` is the
  longest time limit a supporter may set (60–3,600); `allowExtension` lets the streamer add time from the 리모컨.
- `roulette.items[].percent` add up to 100; `dailyLimit` 0 = no limit (per member per day).
- `gacha[].mode`: `PROBABILITY` (percent per prize) or `STOCK` (`left` per prize, sold out at 0); `limit` = draws per
  member per day, `null` = none.
- Ssumnation shows a type only when its settings are complete (a wheel that does not add up to 100% is not shown).

## 2. A donation — `POST /api/ssumnation/donations`

```json
{ "idempotencyKey": "6a1f…(16–64 of A-Z a-z 0-9 -)", "channelId": 3021, "type": "MINI", "amount": 500,
  "message": "", "details": { "text": "안녕", "colorId": "pink" } }
```

| type | `amount` | `details` | `message` |
|---|---|---|---|
| `MINI` | `minAmount` … `maxAmount` | `{ text (1…maxLength), colorId }` | — |
| `WISHLIST` | the item's price the member confirmed | `{ itemId }` | ≤ 100, read out / shown with the alert |
| `DRAWING` | ≥ `game.minAmount` | `{ title (1…game.maxTitle), image: PNG data URL ≤ 400,000 chars, showProcess, canvasMode }` | — |
| `QUEST` | the 성공 보상, ≥ `game.minAmount` | `{ title (1…game.maxTitle), timeLimitSec (1…quest.maxTimeSec), creatorDecides }` | — |
| `ROULETTE` | ≥ `minAmount` (one spin) | `{}` | — |
| `GACHA` | the 뽑기's price the member confirmed | `{ gachaId }` | — |

FLEXTV must:

1. **Keep one donation per `(member, idempotencyKey)`.** The same key with the same body answers what the first request
   answered (while it is still being handled: `202 { "status": "PROCESSING" }`); the same key with another body answers
   `409 { "status": "CONFLICT" }`. Keep keys at least 24 hours.
2. **Check before debiting**, in one transaction with the debit: the member may donate (본인인증, age, blocks, the
   re-auth gate — the same rules as `/api/luv/send`); the type is on for the channel; the amount and fields are within
   the settings; for `WISHLIST` · `GACHA` the price equals `amount` (else `PRICE_CHANGED`); the roulette daily limit, the
   뽑기 per-member limit and stock (else `LIMIT_REACHED` · `SOLD_OUT`); the balance (else `INSUFFICIENT`); its
   forbidden words on `text` · `title` · `message` (else `INVALID` with its message).
3. **Debit and record together**: the ledger debit, the type's record (the spin with its drawn result, the draw with its
   prize, the 미니 text, the drawing, the quest), and the key's answer — all or nothing. The 룰렛 result and the 뽑기
   prize are drawn by FLEXTV at payment, by the streamer's percentages (or stock), and kept hidden until revealed on the
   broadcast. A `QUEST` is **held**: the 렉스 leave the member's balance but reach the streamer only on SUCCESS
   (FLEXTV's 럭키카드 already holds 렉스 this way); FAILED and CANCELED give them back (§6).
4. **Deliver it to the broadcast** as its other donations: the chat line and the 도우미 alert, with the type in the
   payload (e.g. `args.ssumnationType: "MINI"`), and the state of §8 · §9 for Ssumnation's 리모컨 and overlays.

Answers:

```json
{ "status": "COMPLETED", "donationId": "88812", "amount": 500, "balance": 4500 }
```

| status | HTTP | Meaning |
|---|---|---|
| `COMPLETED` | 200 | debited (held, for a quest); `donationId` is FLEXTV's (its `sponsorId`) |
| `PROCESSING` | 202 | the key is being handled; ask again |
| `INSUFFICIENT` | 400 | `balance` |
| `PRICE_CHANGED` | 400 | `amount` = the price now; nothing debited |
| `INVALID` · `NOT_ALLOWED` · `LIMIT_REACHED` · `SOLD_OUT` | 400 | nothing debited; `message` for the member |
| `CONFLICT` | 409 | the key was used for another donation |

A 5xx or no answer is unknown to Ssumnation: it asks with §3 before anything else.

## 3. A donation by its key — `GET /api/ssumnation/donations/:idempotencyKey`

Member. The answer §2 gave (or gives now) for this member's key; `404 { "status": "NOT_FOUND" }` when FLEXTV never
received it — Ssumnation then sends §2 again with the same key.

## 4. The room's 룰렛 · 뽑기 — `GET /api/ssumnation/channels/:channelId/games`

Token optional. Counts for everyone; with a token, the member's own spins and draws (newest first, today and the
unfinished ones). A result or prize is sent only once it is revealed on the broadcast.

```json
{
  "roulette": { "waiting": 2, "participantsToday": 5, "usedToday": 1,
                "mine": [{ "id": "s1", "no": "#RLT-00012", "amount": 1000, "createdAt": "2026-10-25T01:00:00Z",
                           "status": "QUEUED", "position": 2, "result": null }] },
  "gacha": { "waiting": 0, "usedToday": { "g1": 1 },
             "mine": [{ "id": "d1", "no": "#GCH-00003", "gachaId": "g1", "gachaName": "행운 뽑기", "amount": 3000,
                        "createdAt": "2026-10-25T00:30:00Z", "status": "RESULT", "position": null, "prize": "사인", "blank": false }] }
}
```

- Spin `status`: `QUEUED` · `SPINNING` · `WAITING` (stopped, waiting for 결과 공개) · `RESULT` · `DONE`.
- Draw `status`: `QUEUED` · `SPINNING` · `RESULT` · `DONE`.
- Viewers ask every 3 seconds; Ssumnation keeps one answer per channel and viewer for 2 seconds. A pushed event (the
  chat socket) can replace polling later.

## 5. The streamer's settings — `GET · PUT /api/ssumnation/my/donation-settings`

Member, a streamer (memberDiv 2 · 3), **for the caller's own channel only**. Ssumnation's 후원 종류 설정
(`/creator/donation-types`) reads and saves them.

- `GET`: the §1 shape with every section present and `enabled` on each (a section that is off keeps its values, and
  every 뽑기 has `enabled`); `404 { "status": "NOT_FOUND" }` when the streamer never saved (Ssumnation starts from
  everything off).
- `PUT` body: the same shape. 위시리스트 items and 뽑기 without an `id` are new (FLEXTV gives them one); an item missing
  from the list is removed (records of donations already made keep their copy).
- Answer: `{ "status": "SAVED", "settings": { …as GET } }`, or `400 { "status": "INVALID", "message": "…" }`.
- FLEXTV checks it again: 미니 `1 ≤ minAmount ≤ maxAmount ≤ 999` with at least one color; `game.minAmount` ≥ 1;
  `quest.maxTimeSec` 60–3,600; 룰렛 2–10 items, names ≤ 12 characters, whole percents adding up to 100 while on,
  `dailyLimit` 0–100; 뽑기 at most 10, 1–20 prizes each, names ≤ 20 characters, whole percents adding up to 100
  (확률형) or a stock per prize (재고형), `limit` null or 1–100; 위시리스트 at most 20 items, names ≤ 20, notes ≤ 40;
  prices 1–100,000,000. A change applies to donations from then on; a spin, draw or quest already paid keeps its terms.

## 6. 퀘스트 — decisions and extensions

A quest runs until someone decides (time running out decides nothing: the overlays show "시간 초과 · 결과 대기").

| Who | May decide |
|---|---|
| the supporter who sent it | `SUCCESS` · `FAILED`, always |
| the streamer of the channel | `CANCELED` always; `SUCCESS` · `FAILED` only when the supporter turned on `creatorDecides` |

- `POST /api/ssumnation/quests/:questId/decision` `{ "decision": "SUCCESS" | "FAILED" | "CANCELED" }` (member; FLEXTV
  works out from the token whether the caller is its supporter or its streamer).
  - `{ "status": "OK", "questStatus": "SUCCESS", "refundedAmount": 0 }` — SUCCESS hands the held 렉스 to the streamer
    (from then on they count as received); FAILED · CANCELED give the whole amount back (`refundedAmount`).
  - Deciding again with the same decision answers the same OK (a retry is safe); another decision after one is made:
    `{ "status": "ALREADY_DECIDED", "questStatus": "FAILED" }`.
  - `403 { "status": "FORBIDDEN" }` (not this caller's to decide), `404 { "status": "NOT_FOUND" }` (no such quest for
    this caller — someone else's quest looks missing).
- `POST /api/ssumnation/quests/:questId/extension` `{ "minutes": 1…60, "requestId": "16–64 of A-Z a-z 0-9 -" }` (the
  channel's streamer, `quest.allowExtension` on): adds the minutes to the deadline, or counts them from now when the
  deadline passed.
  - `{ "status": "OK", "minutes": 10, "endsAt": "2026-10-25T03:10:00Z", "restarted": false }`; the same `requestId`
    answers the first result (with other minutes or another quest: `400 INVALID`).
  - `{ "status": "ALREADY_DECIDED", "questStatus": "SUCCESS" }`, `{ "status": "DISABLED" }`, `400 { "status":
    "INVALID", "message" }`, `404 NOT_FOUND`.

## 7. Lists

**The supporter's** — `GET /api/ssumnation/my/donations?category=quest|game&offset=0&limit=10`: their 퀘스트, or their
룰렛 · 뽑기, newest first, for 후원 내역's 퀘스트 후원 · 게임 후원 tabs.

```json
{ "data": [{ "id": "88812", "donatedAt": "2026-10-25T01:00:00Z", "channelId": 3021, "channelName": "테스트방송국",
             "type": "QUEST", "amount": 3000, "message": "노래 한 곡 불러 주세요",
             "status": "PROCESSING", "refundedAt": null,
             "quest": { "id": "q7", "status": "IN_PROGRESS", "endsAt": "2026-10-25T02:00:00Z", "extendedMin": 0 },
             "game": null }],
  "count": 1 }
```

- `status`: `PROCESSING` (a quest still held), `COMPLETED`, `REFUNDED` (with `refundedAt`).
- `game` for 룰렛 · 뽑기: `{ "kind": "ROULETTE" | "GACHA", "status": <spin or draw status>, "result": "노래 한 곡" | null,
  "blank": false | null }` — the result only once revealed on the broadcast.

**The streamer's quests** — `GET /api/ssumnation/my/channel/quests?status=ALL|IN_PROGRESS|SUCCESS|FAILED|CANCELED&offset=0&limit=10`:

```json
{ "data": [{ "id": "q7", "donorNickname": "열혈시청자", "title": "노래 한 곡 불러 주세요", "amount": 3000,
             "status": "IN_PROGRESS", "createdAt": "2026-10-25T01:00:00Z", "decidedAt": null,
             "endsAt": "2026-10-25T02:00:00Z", "extendedMin": 0, "creatorDecides": true }],
  "count": 1, "held": { "amount": 3000, "count": 1 }, "allowExtension": true, "serverNow": "2026-10-25T01:20:00Z" }
```

Oldest first with `status=IN_PROGRESS` (the 리모컨's order), newest first otherwise. No supporter's 아이디.

## 8. 리모컨 — the streamer's 룰렛 · 뽑기

The broadcast's state is FLEXTV's: a spin goes `QUEUED → SPINNING → WAITING (결과 자동 공개 off) → RESULT → DONE`, a
draw `QUEUED → SPINNING → RESULT → DONE`, with FLEXTV's timings (spin seconds, about 8 seconds of result on screen) and
its 자동 시작 · 결과 자동 공개 switches.

- `GET /api/ssumnation/my/games/roulette` → `{ "enabled", "autoStart", "autoReveal", "paused", "hidden", "dailyLimit",
  "items": [{ "name", "percent" }], "stage", "queue": [<spin>], "recent": [<spin>], "participantsToday" }`:
  - `stage` (the spin on screen, or null) = `{ "id", "no", "status": "SPINNING" | "WAITING" | "RESULT", "donor", "amount",
    "items", "nth", "limit", "result" (null until revealed), "endsAt" }`;
  - a spin row = `{ "id", "no", "donor", "amount", "createdAt", "nth", "status", "result" }`.
- `POST /api/ssumnation/my/games/roulette` `{ "action": "START_NEXT" | "REVEAL" | "FINISH" | "PAUSE" | "RESUME" |
  "HIDE" | "SHOW" | "SWITCH", "spinId"?, "key"?: "enabled" | "autoStart" | "autoReveal", "on"? }` → `{ "status":
  "SAVED" }`, or `400 { "status": "INVALID", "message" }` (busy, nothing waiting, not in that state …).
- `GET /api/ssumnation/my/games/gacha` → `{ "stage", "queue": [<draw>], "recent": [<draw>], "unclaimed", "hidden" }`:
  - `stage` = `{ "id", "no", "status": "SPINNING" | "RESULT", "gachaId", "gachaName", "donor", "amount", "message",
    "prize", "blank", "endsAt" }` or null — `gachaId` is the 뽑기's id of §5, so the overlay draws it in its look (§10);
  - a draw row = `{ "id", "no", "gachaName", "donor", "amount", "createdAt", "status", "prize", "blank", "claimed" }`.
- `POST /api/ssumnation/my/games/gacha` `{ "action": "FINISH" | "CLAIM" | "UNCLAIM" | "HIDE" | "SHOW", "drawId"? }` →
  `{ "status": "SAVED" }` or `400 INVALID` (a 꽝 is never claimed).
- 퀘스트 on the 리모컨 uses §6 and §7 (`status=IN_PROGRESS`).

## 9. OBS overlays

Ssumnation serves the overlay pages (`/overlay/widget/{roulette|gacha|gacha-board|quest|mini}/{key}`); FLEXTV gives the
key and the state. The 후원 알림 stays FLEXTV's 도우미 alert.

- `GET /api/ssumnation/my/overlay-key` → `{ "key": "…" }` (a secret of 16–64 of A-Z a-z 0-9 -); `POST` the same path
  issues a new one — the old one stops at once.
- `GET /api/ssumnation/overlay/:key/:widget` (no token: the key is the credential; unknown key → 404). Overlays ask every
  2 seconds.
  - `roulette` → `{ "stage": <as §8> | null }` (null while hidden)
  - `gacha` → `{ "stage": <as §8> | null, "history": [{ "donor", "prize" }] }` (latest first, no 꽝)
  - `gacha-board` → `{ "rows": [{ "id", "donor", "gachaName", "prize", "claimed" }] }`
  - `quest` → `{ "quests": [{ "id", "title", "amount", "endsAt", "extendedMin" }] }` (running quests, oldest first)
  - `mini` → `{ "lines": [{ "id", "nickname", "amount", "text" }] }` (the latest 미니 후원, newest first)

## 10. Overlay design — `GET · PUT /api/ssumnation/my/overlay-design`

Ssumnation's 위젯 page (`/creator/widgets`) sets how the overlays of §9 look: the 오버레이 테마 every overlay is drawn in,
and per overlay its theme, fonts, layout and what it shows (퀘스트's style and how many, 미니's band or bubble, speed and
the smallest amount it shows, the 뽑기 machine and point color of each 뽑기, the 크레딧 and 당첨 리스트 title and speed).
FLEXTV keeps it as **one document per streamer, as it is given**: Ssumnation owns its fields, checks every one before it
sends it, and reads it leniently (an unknown or wrong field is its default). The rules — items, odds, prices,
minimums — stay §5's and are never in it.

- `GET` (member, a streamer, the caller's own channel) → `{ "status": "OK", "design": { … } }`, or
  `404 { "status": "NOT_FOUND" }` when the streamer never saved one (Ssumnation shows its defaults).
- `PUT` the same path, body `{ "design": { … } }` → `{ "status": "SAVED" }`, or `400 { "status": "INVALID", "message" }`
  for a body that is not a JSON object or is larger than 16 KB. The whole document is replaced.
- `GET /api/ssumnation/overlay/:key/design` (no token: the key of §9 is the credential; unknown key → 404) →
  `{ "design": { … } | null }`. The overlays read it with their state; Ssumnation asks at most once a second per key.
- The document today (version 1; Ssumnation may add fields, FLEXTV keeps whatever it is given):
  `{ "version": 1, "appearance": { "theme", "accent" }, "roulette": { "theme" }, "gacha": { "theme", "credit": {
  "historyCount", "displaySec" }, "board": { "title", "speed" }, "looks": { "<§5 뽑기 id>": { "style", "pointColor" } } },
  "quest": { "theme", "enabled", "style", "titleFont", "timeFont", "prizeFont", "maxCount" }, "mini": { … } }`. Text in
  it (the 당첨 리스트 title) is shown on stream: FLEXTV's forbidden words may be applied to it, nothing else changes.
