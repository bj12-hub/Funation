# Creator Domain

Creator capabilities include:

- registration
- profile
- dashboard
- donation management
- donation settings
- widgets
- financial report
- settlement
- platform connections

Supported:

- YouTube
- FlexTV
- SOOP

## 크루 방송 점수 (code-first, `services/crew`)

Points are display scores, not money.

- 강탈엔 배틀 배수 미적용 (2026-10-07 결정): a 기여도 강탈 inside a running ×n battle moves board points as they are.
  The battle 배수 multiplies only what members received (main scoreboard bonus and battle sides); a steal never
  takes more than the target's current scoreboard score, so nobody goes below 0.
- 방송 시작 · 멤버 추가 carry a request id (one per intended action): a double click or retry returns SAVED instead of
  a second broadcast or member. 방송 종료 is idempotent (a second call keeps the first 종료 시각 · 최종 순위). The
  "one live broadcast" and member limit / unique name checks run in the same step as the write.
