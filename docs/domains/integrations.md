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

## 통합 채팅 (unified chat)

- `services/broadcast/chatCore.ts` merges every connected platform's chat into one feed.
- Messages are deduped by `${platform}:${externalMessageId}` (reconnects re-deliver messages).
- A newly connected channel starts from "now"; the backlog is not replayed.
- One platform failing (timeout, outage) never blocks the others; its error shows on its row.
- **Hide** is Somnation-only and works for every platform (the overlay stops showing the message).
- **Delete** and **ban** act on the platform, and only where CHAT_MODERATE is declared.
- **Send** (통합 입력) posts to every chosen platform with CHAT_SEND and reports the result per platform.
  `requestId` makes retries deterministic: a retry only re-attempts the platforms that failed.
- Forbidden words are auto-hidden (`FILTER`).
- Channel connections: `services/broadcast/channelsCore.ts`. YouTube reuses 유튜브 연동; the others
  connect by channel id in the mock.

## 통합 후원 알림 (unified donation alerts)

- Every platform's donation events go through `services/creator/donationLink.ts` into the **one**
  alert queue (`alertCore.ts`). Alerts play one at a time, never at once.
- Each platform event is deduped by `${platform}:${externalEventId}`.
- Amounts stay in the platform's own unit: KRW/USD 슈퍼챗, 치즈, 별풍선, FlexTV TBD. They are never
  converted to FN, and they create no wallet, earnings or settlement records.

## TBD

- Transport: the mock reads on demand (studio/overlay polls). Production needs a live connection per
  platform (YouTube polling with quota; CHZZK/SOOP/FlexTV sockets) and a push channel to overlays.
- Per-creator feeds and queues (the mock has one creator), persistence, rate limits.
- Matching one person across platforms, and moderator accounts.
