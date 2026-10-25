# FLEXTV ↔ Ssumnation API (6단계 · 썸네이션 전용 후원)

Status: **contract, front first** (2026-10-25). Ssumnation's side is built against it (`apps/web/src/lib/flextv/ssumnation.ts`)
and tested with a stand-in; FLEXTV implements it next. Until FLEXTV serves it, Ssumnation keeps it off
(`FLEXTV_SSUMNATION_API` unset) and a FLEXTV channel offers FLEXTV's own types only.

Ssumnation's screens offer donation types FLEXTV has no endpoint for: **미니 · 위시리스트 · 그림 · 룰렛 · 뽑기**
(퀘스트 follows with its decisions; 영상 후원 needs nothing new — it goes through FLEXTV's `POST /api/luv/send` YouTube
effect, priced by the streamer's 도우미 setting from `GET /api/luv/effect-settings`). This document is what FLEXTV adds.

## Conventions

- Base path `/api/ssumnation` on FLEXTV's API server. Member routes take the member's Bearer token (as every other call
  Ssumnation makes) and sit behind FLEXTV's member-only gate; `caller` comes from the token only.
- Ssumnation calls from its server only, with the member's `X-Forwarded-For` and `User-Agent`.
- Amounts are whole 렉스. Ids are strings of `[A-Za-z0-9_-]{1,40}` unless said otherwise.
- Every answer is JSON with a `status`. Messages meant for the member are Korean, short (≤ 100 characters), and never
  carry internal detail (SQL, stack traces, keys).
- The 렉스 move through FLEXTV's existing ledger (the same debit procedure as `/api/luv/send`), so 잔액, 받은 렉스, 정산
  and 후원 내역 keep working as they do.

## 1. A channel's settings — `GET /api/ssumnation/channels/:channelId/donation-settings`

Public (no token). What the streamer turned on; a type that is off is `null` or empty. 404 = the channel has none.

```json
{
  "mini": { "enabled": true, "minAmount": 100, "maxAmount": 999, "maxLength": 30,
            "colors": [{ "id": "pink", "label": "핑크", "hex": "#FF5CA8" }] },
  "wishlist": [{ "id": "w1", "emoji": "🎧", "name": "헤드셋", "price": 30000, "note": "", "inStock": true }],
  "drawing": { "enabled": true, "minAmount": 1000, "maxTitle": 50 },
  "roulette": { "enabled": true, "minAmount": 1000, "dailyLimit": 0,
                "items": [{ "name": "노래 한 곡", "percent": 30 }, { "name": "꽝", "percent": 70 }] },
  "gacha": [{ "id": "g1", "name": "행운 뽑기", "price": 3000, "mode": "PROBABILITY",
              "prizes": [{ "name": "꽝", "blank": true, "percent": 50, "left": null }, { "name": "사인", "blank": false, "percent": 50, "left": null }],
              "limit": 2, "soldOut": false }]
}
```

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
| `DRAWING` | ≥ `minAmount` | `{ title (1…maxTitle), image: PNG data URL ≤ 400,000 chars, showProcess, canvasMode }` | — |
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
   prize, the 미니 text, the drawing), and the key's answer — all or nothing. The 룰렛 result and the 뽑기 prize are drawn
   by FLEXTV at payment, by the streamer's percentages (or stock), and kept hidden until revealed on the broadcast.
4. **Deliver it to the broadcast** as its other donations: the chat line and the 도우미 alert, with the type in the
   payload (e.g. `args.ssumnationType: "MINI"`) so the alert and the overlays can show it.

Answers:

```json
{ "status": "COMPLETED", "donationId": "88812", "amount": 500, "balance": 4500 }
```

| status | HTTP | Meaning |
|---|---|---|
| `COMPLETED` | 200 | debited; `donationId` is FLEXTV's (its `sponsorId`) |
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

## Next (6단계 후반)

- **Streamer settings**: `GET · PUT /api/ssumnation/my/donation-settings` (the §1 shape, the streamer's own channel only)
  for Ssumnation's studio.
- **Broadcast control**: start the next spin · reveal · 뽑기 결과 공개 from Ssumnation's 리모컨 and overlays, or from the
  도우미.
- **퀘스트**: the donation (held until decided), the supporter's and the streamer's decisions, the refund of a failed or
  cancelled quest.
- **Supporter history**: the type and the 룰렛 · 뽑기 result in `GET /api/luv/sentluv-list` (or a Ssumnation list), for
  후원 내역.
