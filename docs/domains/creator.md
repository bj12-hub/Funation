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

Uploads (mock): profile images, 칭호 icons, 정산 서류 and the image · sound library are checked by their bytes, not the
declared type (`matchesContent` in `assetCore.ts`; PDF by its `%PDF-` header). A renamed file is refused with the
screen's existing type message.

Supported:

- YouTube
- FlexTV
- SOOP

## 리모컨 알림 제어 (code-first, `services/creator/alertRemote`)

- 현재 알림 건너뛰기 names the alert the remote showed (`alertId`); if it already ended, nothing is skipped (never
  the next, possibly paid, alert).
- 전체 알림 취소 cancels the showing and queued alerts up to the newest one the remote listed (`upToId`); alerts that
  arrived after the operator looked stay queued.
- 다시 보내기 carries a request id: a double click or retry queues one copy.
- 방송 도구 타이머 퀵 조정: a countdown that ran out counts as 0, so the first +30 / +60 adds that much time.

## 크루 방송 점수 (code-first, `services/crew`)

Points are display scores, not money.

- 강탈엔 배틀 배수 미적용 (2026-10-07 결정): a 기여도 강탈 inside a running ×n battle moves board points as they are.
  The battle 배수 multiplies only what members received (main scoreboard bonus and battle sides); a steal never
  takes more than the target's current scoreboard score, so nobody goes below 0.
- Every 배수 (자동엑셀 규칙 · 기여도 · 배틀 · 직급, two decimals) multiplies in whole hundredths with one rounding, so
  all boards agree (×1.15 on 50 = 58).
- 이번 달 멤버 순위 counts by the server's local month (Asia/Seoul), so 00:00–08:59 on the 1st is the new month.
- 방송 시작 · 멤버 추가 carry a request id (one per intended action): a double click or retry returns SAVED instead of
  a second broadcast or member. 방송 종료 is idempotent (a second call keeps the first 종료 시각 · 최종 순위). The
  "one live broadcast" and member limit / unique name checks run in the same step as the write.
- The OBS crew overlay (`/overlay/crew/[key]`, key only) gets the 콘텐츠 시나리오 부 이름 · 예정 시간, never the
  operator's 메모 (nor 보정 logs or 팬 메시지). It carries `serverNow`: the 강탈 card and 시나리오 경과 time run on the
  server clock, not the OBS PC's.
