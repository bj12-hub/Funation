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
  (브랜드 이름 + 사이트 경로: ssumnation, ssumnation, wallet, api, login, …)와 같은 사용 중 목록(현재 주소 포함)을 쓰고,
  마지막 await 뒤에 다시 확인한 다음 같은 틱에 쓴다.
- **예전 채널 주소는 새 주소로 연결 (2026-10-08 결정)**: 주소를 바꾸면 이전 주소는 30일(정해진 예시 값, 바꿀 수 있음)
  동안 새 주소로 연결되고(`/creators/<예전 주소>` → `/creators/<새 주소>`, 임시 리다이렉트), 그동안 다른 채널이 쓸 수
  없다. 채널 자신은 예전 주소로 되돌아갈 수 있다. 목업의 스튜디오 채널은 공개 채널 페이지가 없고(채널별 연결 TBD)
  `ssumnation.com/donate/<주소>`는 이 앱에 경로가 없어, 그 경로의 연결은 백엔드와 함께 정한다(TBD).

## 이용 정지된 크리에이터 (`services/admin/memberCore.ts` `isCreatorSuspended`)

- 정지 기간 동안 채널은 공개 화면에서 사라진다: 크리에이터 찾기, 채널 페이지(`getCreatorById`가 없음으로 답함), 홈
  "요즘 인기 많은 크리에이터" 줄.
- **즐겨찾기 (2026-10-08 결정)**: 정지 기간 동안 `/favorites` 목록에서도 빠지고, 건수 · 페이지 · 빈 화면도 보이는 목록을
  따른다. 저장된 즐겨찾기는 지우지 않으므로 정지가 풀리면 다시 보인다.

### 키 · 링크 접근 (`services/account/creatorAccess.ts`)

[wallet](./wallet.md) "정지 · 탈퇴 중에는 키 · 링크로 하는 접근도 막힙니다"의 목록. 로그인 없이 키 · 링크만으로 채널 대신
동작하는 주소는 정지 기간(기간 정지 · 영구 정지)과 탈퇴 뒤에 모두 막힌다(`creatorAccessOpen`). 도우미 호스트에서도 같다.

| 주소 | 막혔을 때 |
|---|---|
| OBS 오버레이 `/overlay/<종류>/<연동 키>` — 후원 알림 · 통합 채팅 · 후원 위젯 14종(`/overlay/widget/*`) · 방송 도구 5종(`/overlay/tool/*`) · 배너 · 이펙트 · 영상 후원 · 그림 후원 · 크루 점수판, 그리고 오버레이가 주기적으로 읽는 데이터(리모컨 신호 포함, `overlayKeyOpen`) | 잘못된 키와 같음: 페이지는 오버레이 404(투명, 아무것도 그리지 않음), 읽기는 `FORBIDDEN`. 방송 화면에 오류 문구는 없다. 이미 열려 있던 오버레이는 다음 읽기에서 비워진다 |
| 매니저 채팅 링크 `/popout/chat/m/<토큰>` (보기 · 숨김 · 삭제 · 차단 · 통합 입력) | 지운 링크와 같은 거부 화면 · `UNAUTHORIZED` |
| SMS 계좌후원 주소 `/api/bank-sms/<키>` | 403 `{ "status": "OFF" }`, 문자는 기록되지 않음 |

- 정지가 풀리면(기간 만료 또는 운영자의 정지 해제) 같은 키 · 링크로 다시 동작한다(재발급 없음). 열려 있던 통합 채팅
  오버레이는 계속 확인하다가 스스로 돌아오고, 다른 오버레이는 OBS 브라우저 소스를 새로 고치면 돌아온다.
- 탈퇴는 이전처럼 오버레이 키 · SMS 주소를 재발급하고 매니저 링크를 지운다([wallet](./wallet.md) 회원 탈퇴).
- 키 · 링크가 아니라 따로 막지 않는 것: 리모컨(`/popout/remote` · `/creator/remote`), 통합 채팅 창(`/popout/chat`), 스튜디오와
  도우미 화면은 크리에이터 세션으로만 열리고, 정지 · 탈퇴 중에는 세션이 없다(로그인 · 기존 세션 모두 막힘).
- 이번 목록에 넣지 않은 것(TBD): `/api/media/<id>` · `/api/custom-sound/<id>`는 채널 대신 동작하지 않는 파일 주소(라이브러리
  이미지 · 사운드, 추측할 수 없는 id)라 정지 중에도 그대로 응답한다.

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
- Donor names (2026-10-09 결정): 후원 리스트 entries and member attributions keep the name as sent (`donor`, for the
  creator's 방송 운영 후원 리스트 and 받은 후원 › 크루 후원) and the name for the stream (`shownDonor`: a Ssumnation
  donation's name after the creator's 대체 메시지 rules — 익명 or the 대체 문구 — fixed when it was sent, so a later 금지어
  change does not rewrite it; see [donation](./donation.md)). Anything on stream that names a donor from these records
  uses `shownDonor`; today none does — the OBS crew views and the 크루 순위 widget show member names only.
- The OBS crew overlay (`/overlay/crew/[key]`, key only) gets the 콘텐츠 시나리오 부 이름 · 예정 시간, never the
  operator's 메모 (nor 보정 logs or 팬 메시지). It carries `serverNow`: the 강탈 card and 시나리오 경과 time run on the
  server clock, not the OBS PC's.
