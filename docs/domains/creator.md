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
Library and signature names are stored and compared in Unicode NFC (macOS sends decomposed Korean file names), so
짝 매칭, search, sorting and the same-name check treat them as typed.

Saves that await (reading a file, the mock delay) check the store again after the last await and write in the same
tick — 커스텀 사운드, 벽지 이미지, 라이브러리 업로드, 금지어 · 필터 단어 — so concurrent requests never lose each
other's adds, bring a deleted item back or pass a cap or duplicate check together.

Supported:

- YouTube
- FlexTV
- SOOP

## 채널 주소 = 후원 페이지 주소 (`services/channel/handleCore.ts`)

- **규칙 통일 (2026-10-08 결정)**: 채널 만들기(`/channel/new`)와 후원 페이지 링크 설정(`/creator/donations`) 모두
  영문 소문자 · 숫자 · 하이픈 3~30자(하이픈으로 시작 · 끝 · 연속 불가, `isValidChannelHandle`). 예약어 목록 하나
  (브랜드 이름 + 사이트 경로: somnation, funation, wallet, api, login, …)와 같은 사용 중 목록(현재 주소 포함)을 쓰고,
  마지막 await 뒤에 다시 확인한 다음 같은 틱에 쓴다.
- **예전 채널 주소는 새 주소로 연결 (2026-10-08 결정)**: 주소를 바꾸면 이전 주소는 30일(정해진 예시 값, 바꿀 수 있음)
  동안 새 주소로 연결되고(`/creators/<예전 주소>` → `/creators/<새 주소>`, 임시 리다이렉트), 그동안 다른 채널이 쓸 수
  없다. 채널 자신은 예전 주소로 되돌아갈 수 있다. 목업의 스튜디오 채널은 공개 채널 페이지가 없고(채널별 연결 TBD)
  `somnation.com/donate/<주소>`는 이 앱에 경로가 없어, 그 경로의 연결은 백엔드와 함께 정한다(TBD).

## 벽지 위젯 (`services/creator/wallpaperCore.ts`)

- A sticker keeps the 벽지 image it first got (`mockWallpaper.stickerImages`), so uploading or deleting an image never
  re-maps the stickers already on the wall and every reload shows the same wall. A sticker whose image was deleted
  takes the rotation's image from the current list and keeps it.

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
- 자동엑셀 환산값 and 후원 리스트 entries are keyed by unit code (`SOOP_BALLOON`, `CHZZK_CHEESE`, `FLEXTV_UNIT`, `KRW` …;
  table in [integrations](./integrations.md)), never by label. Values saved by label before 2026-10-08 move to the code
  when read (a value already under the code wins); 계좌 후원 is `KRW` with no platform. Rates stay creator-entered (TBD).
- 이번 달 멤버 순위 counts by the server's local month (Asia/Seoul), so 00:00–08:59 on the 1st is the new month.
- 방송 시작 · 멤버 추가 carry a request id (one per intended action): a double click or retry returns SAVED instead of
  a second broadcast or member. 방송 종료 is idempotent (a second call keeps the first 종료 시각 · 최종 순위). The
  "one live broadcast" and member limit / unique name checks run in the same step as the write.
- The OBS crew overlay (`/overlay/crew/[key]`, key only) gets the 콘텐츠 시나리오 부 이름 · 예정 시간, never the
  operator's 메모 (nor 보정 logs or 팬 메시지). It carries `serverNow`: the 강탈 card and 시나리오 경과 time run on the
  server clock, not the OBS PC's.
