# Events (이벤트)

Code-first (no Figma frame): site `/events`, `/events/[id]` (`features/events/*`, `services/events/*`); console
운영 › 이벤트 `/events` (`apps/admin` `features/events/*`, site API `services/admin/events.ts`).

## Participation (2026-10-08 결정)

- Joining is idempotent and only open while the event runs (whole Korean days).
- **Once per event per person**, identified like 출석 by the phone verified at sign-up (the person key). A 재가입 with
  the same phone has joined; another person can join. Responses carry counts and the viewer's own state only.

## Rewards (2026-10-08 결정)

- The operator sets **one reward per event** in the console:
  - **참여자 전원 무상 FN** — an amount the operator enters. There is no default amount.
  - **추첨 N명 경품** — a winner count N and prize text the operator enters.
- Form bounds are sanity limits, not business rules: 1–10,000,000 FN, 1–1,000 winners, prize 2–100자 (platform forbidden
  words refused). Saving the same reward again changes and logs nothing; every change is audited (`EVENT_REWARD_SET`,
  with the previous reward). The reward can no longer change once its result is out.
- The site's event detail shows the reward (「참여자 전원에게 무상 FN n FN을 드려요.」 /
  「참여자 중 N명을 추첨해 경품을 드려요.」 + 경품) instead of the TBD note, which stays while no reward is set.

## After the event

Both actions run only after the event ended, once per event (a console request id makes a retry answer OK without a
second payout or draw; a second action is refused), with the checks and writes in one synchronous step, and are audited.

- **보상 지급** (`EVENT_REWARD_PAY`): each participant — counted per person — is credited once, to **the account that
  belongs to that person now**, as **무상 FN** with a wallet record (FN Wallet 보상 「이벤트 보상 · 이벤트 이름」). Free FN are
  refund-excluded and spent first, like 출석 보상 (docs/domains/wallet.md 환불 정책).
- **당첨자 추첨** (`EVENT_DRAW`): the server draws min(N, pool) winners with a fair random pick (partial Fisher–Yates with
  the CSPRNG, `services/events/eventDraw.ts` — server-only). The pool is the participants who have an account now. The
  site announces the winners with masked nicknames (홍길동 → 홍*동, taken at the draw).
- **지급 불가**: a participant with no account now (withdrawn, no new account) is skipped — not paid, not in the draw —
  and listed as 지급 불가 in the console under their withdrawn account's nickname (탈퇴), or 「확인할 수 없는 참여자」 once
  their 본인 확인 값 is gone.
- The site shows 「보상이 지급됐어요」 or 「당첨자를 발표했어요」 (+ masked winners), and to a participant: 「보상 n FN을
  받았어요」 (only on the account that was credited), 「당첨됐어요」 or 「아쉽지만 당첨되지 않았어요」.
- **사이트 알림 (2026-10-09 결정)**, header bell, kind 이벤트 (🎉), linking to `/events/<id>`, once per result and account
  (dedupe key `event-reward:` / `event-draw:<event>:<account>`), only to the participant's current account — a person with
  none (지급 불가) gets nothing, and a later account of the same person gets nothing either:
  - 보상 지급: 「이벤트 보상 1,500 FN을 받았어요」 · 이벤트 이름.
  - 당첨자 추첨: winners 「이벤트에 당첨됐어요」 · 「이벤트 이름 · 경품 굿즈 세트」; the rest of the pool 「당첨자를
    발표했어요」 · 이벤트 이름 (the same words as the event page's outcome line, so it reads as an announcement, not a
    result).

## TBD

Eligibility rules, 경품 고시 · 제세공과금, how a prize is delivered (contacting winners), notifications, closing an
event early.

Mock: the account slot is the only account, so only its person can be paid; the ended sample event (출석체크 챌린지)
has the sample member's join so a payout or draw can be tried. Each sample event's `baseParticipants` is a display count
on the site, not people.
