# Open Decisions

Confirmed:

- Frontend: Next.js + TypeScript
- Platforms: YouTube + FlexTV + SOOP + CHZZK
- Login lock (2026-10-08): 5 wrong passwords lock the account until a password reset — reset-only, no time-based unlock,
  no per-IP limit (`services/auth/loginLockCore.ts`)
- Approved settlements at a 탈퇴 (2026-10-08): they are still paid (지급 완료) — a 탈퇴 forfeits only 정산 가능 and
  requests 심사 대기 (탈퇴 소멸, never paid); see docs/domains/settlement.md
- 이용 정지 and money (2026-10-08): a suspended member's or creator's settlements and charge refunds are processed as
  usual. Operators instead put a suspicious settlement request (심사 대기 · 승인) or charge refund request (심사 대기) on
  **보류** with a required memo — an audited operator flag (`SETTLEMENT_HOLD` / `SETTLEMENT_RELEASE` / `REFUND_HOLD` /
  `REFUND_RELEASE`), not a member-facing state; 승인 · 반려 · 거절 · 지급 완료 wait for 보류 해제. See docs/domains/settlement.md
  and wallet.md
- KRW amount of a 수수료 공제 후 환불 (2026-10-08): net refund FN ÷ that charge's FN × that charge's paid KRW, rounded
  down to the won (30,000 FN paid 33,000원, 4,500 FN refunded → 4,950원); a 전액 취소 returns the whole paid amount.
  Computed on the server only and stored with the request and with the approval (`services/wallet/refundPolicy.ts`
  `refundKrw`). How each payment method pays it out stays TBD with the payment provider
- Remaining FN of a suspended member (2026-10-08): kept during a suspension — unusable while suspended (no session),
  usable again once it is lifted. For a 영구 정지 the operator settles them on the member's request (남은 FN 정리 on the
  console's member detail): the paid FN refunded per charge under the refund policy (FIFO, free FN first; 전액 취소 when
  still within 7 days and unused, otherwise the 10% fee), the free FN forfeited, the balance zeroed, audited as
  `MEMBER_FN_SETTLE`; a refund request waiting or on 보류 is decided first. See docs/domains/wallet.md "이용 정지와 남은 FN"
- SOOP · FlexTV donations with an unknown result (2026-10-08): the FN stays held (PENDING) and the server re-checks the
  result with the platform for 24 hours (lazily — 후원 내역, the 회원 탈퇴 screen and button, the same-key retry, the console
  list). A result completes the
  donation or returns the FN with a wallet record; after 24 hours an operator decides 성공 / 실패 in 확인 중 후원 with a
  required memo (`PLATFORM_DONATION_RESOLVE`). A 실패 for an account that has withdrawn since is not credited (forfeited).
  See docs/domains/integrations.md
- Event rewards (2026-10-08): set per event by an operator — 참여자 전원 무상 FN (the amount the operator enters, no default)
  or 추첨 N명 경품 (count and prize text the operator enters). After the event, 보상 지급 credits each participant (per person)
  once as free FN to the account that is theirs now, or 당첨자 추첨 draws the winners on the server (masked on the site);
  people with no account are 지급 불가. See docs/domains/events.md
- 미니 후원 amount (2026-10-09): 100 ~ 999 FN (under 1,000 FN), enforced by the Donation Core (`MINI_MAX_FN`); the
  미니후원 widget's 최소 표시 금액 is 0 ~ 999 FN. See docs/domains/donation.md
- 익명 donations (2026-10-09): a donation sent with 프로필 숨기기 counts toward the 누적 · 활동 등급, but not toward the
  크리에이터 칭호 or any 별명's totals (별명 관리 shows "별명 누적 후원" · "별명 후원 횟수"). See docs/domains/supporter.md
- Replaced names on stream (2026-10-09): an alert whose name the creator's 대체 메시지 rules replaced shows no 등급 · 칭호
  badges and is left out of the 후원랭킹 widget (`nameReplaced`, fixed when queued); the off-stream rankings (채널 월간
  순위, 내 후원 랭킹, 명예의 전당) do not apply those rules. See docs/domains/donation.md
- TTS (2026-10-09): with 후원 메시지 표시 off the alert overlay reads nothing (커스텀 사운드 included); the 시그니처 sound
  still plays
- 사이트 알림 (2026-10-09): a settled 확인 중 플랫폼 후원 (완료 / 실패 · FN 반환) and 이벤트 보상 지급 · 당첨 · 발표 notify
  once per result, the current account only. No push · e-mail (site only, 2026-10-18 결정); other triggers stay TBD
- 회원 탈퇴 and 플랫폼 후원 (2026-10-09): refused while a 플랫폼 후원 of the account still waits for its result (FN held);
  a failed one's returned FN reads "FN 반환", not 환불완료, in the FN 내역, its CSV, the FN Wallet and the console's 후원
  운영. See docs/domains/integrations.md and wallet.md
- FN Wallet type "FN 반환" (2026-10-09): the (+) row of a failed 플랫폼 후원's returned FN has its own type chip and filter
  (`?kind=RETURN`), not 환불; real refunds stay 환불. See docs/domains/wallet.md "FN Wallet 목록 유형"
- Console refund card (2026-10-09): a refund that differs from the request's says which way — "요청 후 FN 사용으로
  줄어듦" or "요청 후 FN이 돌아와 늘어남"; equal stays "요청 때와 같아요". The same direction applies to the member's
  approved-refund note ("요청 후 FN을 사용해 / FN이 돌아와 환불 금액이 바뀌었어요 (요청 때: …).") and the console's
  approval error ("요청 후 FN 사용으로 / FN이 돌아와 환불 금액이 바뀌었어요. …"), and the member's request-time error
  ("그 사이 FN을 사용해 / FN이 돌아와 환불 내용이 바뀌었어요. 바뀐 내용을 확인해 주세요."). See docs/domains/wallet.md
- Event result after 탈퇴 (2026-10-09): a participant skipped as 지급 불가 who is back with a 재가입 account sees "탈퇴한
  계정으로 참여해 보상 대상에서 빠졌어요" (draw and 무상 FN alike), with no notification. See docs/domains/events.md
- Crew broadcast donor names (2026-10-09): on-stream views use the name after the creator's 대체 메시지 rules (익명 or the
  대체 문구), fixed when the donation was sent; the creator's own 방송 운영 후원 리스트 keeps the name as sent. See
  docs/domains/donation.md
- 회원 탈퇴 and charges in progress (2026-10-10): refused while an FN 충전 of the account is in progress — its payment
  provider call still running, or 처리중 waiting for the payment to be confirmed — until it completes or fails
  (`CHARGE_PENDING`), and while an 출석 보상 is on its way (`ATTENDANCE_PENDING`). Checked before the password and again
  in the step that writes the withdrawal; the screen and the button first wait a moment (sample 3 s) for credits on their
  way. A charge or reward that completes after the account withdrew anyway lands on nobody: the charge is listed in the
  console as 완료 · FN 미지급 (탈퇴), the free 출석 FN are simply not paid. See docs/domains/wallet.md and payment.md
- 처리 중 충전 (2026-10-12): a charge still 처리중 (no payment provider confirmation) is listed in the console's 처리 중
  충전 (`/payments/pending`, dashboard 처리 대기); an operator checks with the provider and decides 결제 확인 (FN 지급) or
  결제 취소 (미지급) with a required memo (2~200자, operators only) — once, by console request id, audited
  (`PENDING_CHARGE_RESOLVE`). 결제 확인 for an account that has withdrawn credits nobody (완료 · FN 미지급 (탈퇴)). This is
  also what lets the sample member withdraw on a dev server once ch1 is decided. See docs/domains/wallet.md "충전 진행 중"
- 처리 중 충전 follow-ups (2026-10-13, 기본값 — 일반적인 기준, 법무 검토 전): a charge that stayed 처리중 and was confirmed
  later counts its 7-day 청약철회 period from the 결제 확인 (when the payment completed and the FN were supplied), not from
  the request — stated in the member's refund policy summary, the console summary and the `/terms/refund` 초안. Members
  see a cancelled payment as "결제 취소" (list, detail, CSV, FN Wallet; it was "취소"); a 결제 취소 sends the account one
  notification "FN 충전이 취소됐어요" while it is still active. The console's button on a withdrawn member's card reads
  "결제 확인 (미지급 · 탈퇴)", and the dashboard's 처리 중 충전 tile counts every 처리중 charge, like 처리 대기. See
  docs/domains/wallet.md "충전 진행 중"
- 운영 결정 알림 (2026-10-18, 기본값 — 일반적인 기준): 정산 신청의 승인 · 거절(반려) · 지급 완료와 FN 충전 환불의
  승인 · 거절은 결정이 끝난 뒤 회원에게 사이트 알림 하나를 보냅니다(결과마다 한 번, 같은 결정을 다시 보내도 한 번).
  정산은 새 종류 🧾 정산 → 정산 관리(`/creator/settlement/manage`), 환불은 ↩️ 환불 → 그 충전 날짜의 충전 내역.
  보류 / 보류 해제는 운영자 표시라 알리지 않고, 탈퇴한 크리에이터의 승인 건 지급 완료도 알리지 않습니다(수신함이
  그 계정 것이 아님). 처리 중 충전의 결제 확인 · 결제 취소는 이미 알림이 있습니다(2026-10-13). 푸시 · 이메일은 보내지
  않습니다(2026-10-18 결정). 알림 종류 설정, 사용자별 수신함은 TBD. See docs/domains/settlement.md and wallet.md
- 정산 신청 카드의 최소 금액 (2026-10-18): 카드 문구가 Figma "10,000원" 대신 서버가 적용하는 최소 금액을 FN으로 읽어
  "최소 정산 신청 가능 금액은 40,000 FN 이상입니다 (예시 값 · TBD)."로 보여 줍니다(값 하나, 테스트로 고정). 최소 금액
  자체는 여전히 TBD(Figma 예시 값)
- 리모컨 퀘스트 카드 (2026-10-18, 기본값 — 일반적인 기준, funnation식): 진행 중 퀘스트를 리모컨(`/creator/remote` ·
  작은 창 · 도우미 리모컨)에서도 확인하고, 받은 후원 › 퀘스트와 같은 버튼(성공 / 실패 · 환불 / 취소 · 환불) · 같은
  확인창 · 같은 서버 동작으로 결과를 정합니다. 받은 후원 › 퀘스트도 그대로. 퀘스트 위젯 설정의 "미션 확인 및 수락"
  문구를 실제 동작(받는 즉시 진행, 리모컨 또는 받은 후원에서 결과 결정)에 맞춤. 수락 · 거절 단계와 제한 시간 연장은
  2026-10-18 결정(아래). TBD: 감사 기록에 결정한 곳 남기기. See docs/domains/donation.md
- 스튜디오 메뉴 · 휴대폰 (2026-10-18, 기본값 — 일반적인 기준): 767px 이하에서는 스튜디오 사이드 메뉴를 현재 페이지 이름
  바("🎛️ 리모컨 · 메뉴 ▾") 하나로 접고, 누르면 같은 그룹 메뉴가 드롭다운으로 열립니다(이동 · Escape · 바깥 탭 · 포커스
  이탈 시 닫힘). 768px 이상은 기존 그대로. Figma 반영 전
- 커뮤니티 조회수 (2026-10-18, 기본값 — 일반적인 기준): 로그인 회원은 글당 한국 날짜 하루 1회만 집계하고, 작성자 본인
  조회는 세지 않으며, 댓글 작성 · 삭제 뒤 화면 갱신은 조회가 아닙니다. 비회원은 2026-10-18 결정(아래). TBD: 조회수
  어뷰징 제한. See docs/domains/community.md
- 퀘스트 제한 시간 연장 (2026-10-18 결정): 퀘스트 위젯 "제한시간 연장 사용"이 켜져 있으면 리모컨 퀘스트 카드의 "시간
  연장"으로 진행 중 퀘스트에 분을 더합니다(한 번에 1~60분, 후원자 제한 시간 상한과 같은 단위). 마감이 지난 퀘스트는
  지금부터 다시 셉니다. 요청 id로 한 번만 더하고, 연장 기록(분 · 시각 · 새 마감)은 퀘스트에 남깁니다. 리모컨 · 받은
  후원 › 퀘스트 · 후원자의 후원 내역 · OBS 퀘스트 위젯이 새 마감과 "연장됨 +N분"을 보여 줍니다. 꺼져 있으면 버튼이
  없고 서버도 거절합니다. 연장 횟수 · 총 연장 시간에는 상한을 두지 않습니다(2026-10-18 결정). 연장할 때마다
  후원자에게 사이트 알림 하나("퀘스트 제한 시간이 늘었어요" → 후원 내역)를 보냅니다(2026-10-18 결정). See docs/domains/donation.md
- 퀘스트 수락 단계 (2026-10-18 결정): 받은 퀘스트는 지금처럼 바로 진행됩니다 — 수락 · 거절 단계는 두지 않습니다
- 커뮤니티 비회원 조회수 (2026-10-18 결정): 비회원은 지금처럼 글을 열 때마다 1회 집계합니다(익명 방문자 쿠키 · 하루
  1회 제한 없음). 로그인 회원 규칙은 그대로. See docs/domains/community.md
- 알림 채널 (2026-10-18 결정): 알림은 사이트 알림(헤더 벨 · `/notifications`)만 보냅니다 — 이메일 · 푸시는 보내지
  않습니다
- 상품 순위표 (2026-10-23, 기본값 — 일반적인 기준, StreamDonate 랭킹(상품) · 시간 내 랭킹 참고): 크루 방송 운영에서 등수마다
  상품 · 벌칙 문구(30자 · 글자색)를 적어 OBS(`?prize`)에 띄웁니다. 집계는 방송 전체 점수(메인 점수판) 또는 시작 ~ 정지 구간
  점수(받은 후원 ± 강탈, 보정 제외 — 서브 점수판 · 배틀과 같음). 동점은 이름순, 뺀 멤버만큼 등수가 줄고, 상단 고정 멤버는
  등수 밖에 따로 보입니다. 상품은 화면 문구일 뿐 지급 기능은 없습니다(TBD: 상품 지급). See docs/figma/code-first-screens.md
- 실시간 배틀 다수 팀 · 1:1 여러 쌍 (2026-10-23, 기본값 — 일반적인 기준, StreamDonate 다수 팀 VS 참고): 배틀 방식에 "다수 팀"(2~8팀,
  배틀마다 팀 이름 · 멤버를 정함, 한 멤버는 한 팀에만)과 "1:1 여러 쌍"(최대 12쌍, 한 BJ는 한 쌍에만)을 더했습니다. 점수 · 배수 ·
  메인 점수판 반영 · 강탈 기준은 기존 배틀과 같고, 벌칙은 다수 팀이면 꼴찌 팀, 여러 쌍이면 쌍마다 진 BJ가 합니다(공동 꼴찌 · 무승부는
  이름 없음). 팀 색은 순서대로 고정입니다. See docs/figma/code-first-screens.md
- 엔딩 크레딧 섹션 (2026-10-23, 기본값 — 일반적인 기준, StreamDonate 엔딩 크레딧 참고): 총 후원 · MVP · 후원자 TOP 3 · 후원 순위 ·
  멤버별 · 감사 문구를 영화 크레딧 또는 스타워즈 크롤로 흘립니다. 집계 기간은 오늘(한국 날짜) 또는 크루 방송(진행 중, 없으면 마지막
  방송). 후원자 이름은 후원랭킹과 같은 규칙(익명 · 대체 문구 제외)이고, 총 후원은 썸네이션 FN만 셉니다(플랫폼 후원 환산 TBD).
  MVP는 멤버 1위(오늘은 멤버 지정 FN, 크루 방송은 점수판 점수). See docs/figma/code-first-screens.md
- 알림 모니터 위젯 (2026-10-23, 기본값 — 일반적인 기준, StreamDonate 참고): 최고 후원(기간 안 가장 큰 썸네이션 후원 1건, 알림에
  나온 이름 그대로 — 익명 포함, 상금은 화면 문구만), 후원 모니터링(나오는 알림을 다음 알림까지 유지), 시그 큐 모니터(재생 중 +
  다음 시그니처 알림). 셋 다 알림 대기열을 읽기만 합니다. See docs/figma/code-first-screens.md
- 텍스트 슬롯 · 타이머 후원 연동 · 후원목표 자동 증량 (2026-10-23, 기본값 — 일반적인 기준, StreamDonate 참고): 텍스트 슬롯 20개(슬롯마다
  주소 · 서식, 기능 제어는 자막 스위치), 카운트다운에 완료된 썸네이션 후원 1,000 FN마다 N초(퀘스트 · 플랫폼 후원 제외), 후원목표에
  닿으면 정한 금액씩 목표를 올림(두 번째 목표 제외). See docs/figma/code-first-screens.md
- 시그니처 금액범위 · 그룹 · 시그 카운트 (2026-10-23, 기본값 — 일반적인 기준, StreamDonate 참고): 금액 일치 시그니처는 가격 아래로
  금액범위를 둘 수 있고, 사용 중인 것끼리 금액이 겹치면 저장 · 그룹 켜기를 거절. 그룹은 필터와 한꺼번에 사용 / 숨기기만. 시그 카운트는
  후원자가 고른 멤버 기준(없으면 미지정 줄) — 후원 리스트에서 나중에 배정한 멤버는 반영하지 않음(TBD), 다시 보내기 · 테스트 제외. 후원
  이펙트 영상은 라이브러리에 영상 종류가 생길 때까지 보류. See docs/figma/code-first-screens.md
- 점수 게임 · 스핀머신 (2026-10-23, 기본값 — 일반적인 기준, StreamDonate 참고): 결과는 서버가 뽑고 OBS에서 결과가 나온 뒤
  점수에 들어감(방송 종료 후엔 모두). 배수는 기준 후원 점수에 곱하고 뽑을 때 고정, 배틀 · 직급 배수는 붙이지 않음(강탈과 같음), 한
  후원으로는 게임마다 한 번만. 자동 스핀은 멤버를 고른 시그니처 후원(금액 일치 · 금액범위 포함)만 — 멤버 미지정 · 후원 리스트에서
  배정한 후원은 수동 스핀(TBD: 배정할 때 자동으로 돌릴지). OBS 대기열 3초 + 릴 4초 + 결과 4초, 예시 칸 값은 참고용.
  See docs/figma/code-first-screens.md
- 주사위 게임 · 투휠 게임 (2026-10-23, 기본값 — 일반적인 기준, StreamDonate 참고): 주사위 룰 1 · 룰 2는 StreamDonate 룰 그대로(배수 ×
  기준 후원), 투휠 +n은 n × "+1 점수"(기본 1,000점 — 우리 점수는 FN 단위라 +1 ~ +10 그대로는 너무 작음), ×n은 기준 후원 배수,
  기본 확률은 모두 같게. 자동을 켠 게임은 시그니처 후원 하나에 각각 돌고 점수는 더해짐. 멤버를 고르지 않은 후원은 굴리지 않음
  (StreamDonate는 굴리되 기여도 없음). See docs/figma/code-first-screens.md
- 랜덤시그 (2026-10-23, 기본값 — 일반적인 기준, StreamDonate 참고): 발동 금액과 같은 일반 후원은 그 구간의 시그니처 중 하나(고르게)로
  알림이 나가고, 금액 일치 시그니처가 받는 금액은 그 시그니처가 먼저(같은 발동 금액은 저장 거절). 점수는 크루 방송 중 멤버를 고른
  후원만 — 기본 모드 기본 배수 2배, 랜덤 결과 모드는 발동 후원 점수를 뽑힌 시그 점수로 바꿈(차이가 음수일 수 있음). 앞자리 배수는
  FN 가격에 맞는 자리 단위가 정해질 때까지 TBD, 알림 안 롤링 연출도 TBD. See docs/figma/code-first-screens.md
- 기여도 릴레이 (2026-10-23, 기본값 — 일반적인 기준, StreamDonate 참고): 트리거 BJ가 받은 시그니처 후원이 대기 배수를 정하고(다시 받으면
  새로, 맞는 구간이 없으면 지움), 다른 멤버가 받는 다음 시그니처 후원 한 번에 적용. 트리거 BJ 자신의 다음 후원은 배수를 받지 않고
  새로 정함. 멤버를 고르지 않은 후원은 관여하지 않음. 금액 구간 예시는 StreamDonate 기본값(원)이라 FN 기본값은 TBD.
  See docs/figma/code-first-screens.md
- 줍줍 (2026-10-24, 기본값 — 일반적인 기준, StreamDonate 참고): 같은 금액은 FN 후원 금액이 정확히 같을 때, 같은 금액이 여럿이면 가장
  오래된 것부터 가져감. 기본 모드는 더하기(그 후원 점수만큼 한 번 더). 배수 모드에서 맞는 구간이 없어도 항목은 가져감(1배). 스택은
  방송마다 따로, 끄거나 방송이 끝나도 남지만 다음 방송은 빈 스택에서 시작. 시작/정지 대신 켜기 + 스택 비우기.
  See docs/figma/code-first-screens.md
- 시그니처 메들리 (2026-10-24, 기본값 — 일반적인 기준, StreamDonate 참고): 발동 금액과 같은 일반 후원은 등록 시그니처 중 하나(고르게)로
  알림이 나가고 점수는 따로 없음. 금액 일치 시그니처 → 랜덤시그 → 메들리 순서, 랜덤시그와 메들리는 둘 다 켜져 있을 때 같은 발동
  금액을 쓰지 못함. OBS 뽑기 연출은 크루 방송 중에만(멤버 없는 후원 포함). 후원 통합 관리 재실행은 TBD(지금은 OBS에서 한 번 돌리기).
  See docs/figma/code-first-screens.md
- 시그 빙고 (2026-10-24, 기본값 — 일반적인 기준, StreamDonate 참고): 시그니처가 칸보다 적으면 돌아가며 여러 칸에 배치, 후원 하나는
  그 시그니처의 닫힌 첫 칸 하나만 엶. 공용 판은 줄을 완성한 후원의 멤버, 땅따먹기는 줄 전체를 차지한 멤버가 빙고 보너스(기본 0점)를
  받음. 빙고 줄에 들어간 칸은 수동으로 닫을 수 없음. BJ(팀) · BJ(개인) · 호연 모드는 TBD. See docs/figma/code-first-screens.md
- 복불복 뽑기판 (2026-10-24, 기본값 — 일반적인 기준, StreamDonate 참고): 기본 5×5, 시그니처 후원만 자동 오픈, 최소 금액 0 FN, 자동
  리셋 켬. 후원 하나는 닫힌 칸 하나를 무작위로 엶(멤버 없는 후원 포함). 점수 당첨은 연 멤버에게만(멤버가 없으면 점수 없음). 자동
  리셋은 마지막 결과 연출 뒤(그 전에 다음 오픈이 오면 바로). 시그니처 당첨은 이름 · 이미지만 보여 주고 시그니처를 재생하지 않음.
  확률 · 재고 같은 뽑기 후원(캡슐 기계) 규칙과는 별개. See docs/figma/code-first-screens.md
- 시그니처 헌터 (2026-10-24, 기본값 — 일반적인 기준, StreamDonate 참고): 기본 1라운드(10칸 · 금액 범위 없음 · ×1 · 몰수권 0).
  가격 범위는 라운드 단위(슬롯별 가격 범위는 TBD). 마지막 라운드 뒤에는 마지막 라운드 설정이 반복(6+). 슬롯의 기여도 = 그 후원 점수 ×
  라운드 배수(판매 때 고정, 멤버 없는 후원 · 수동 SOLD OUT은 0). 몰수권은 같은 라운드에서 다른 멤버의 SOLD OUT 기여도를 그 멤버들
  점수에서 옮겨 옴(자기 슬롯 · 몰수권 칸 · 이미 몰수된 칸 제외, 멤버 없이 사면 없음) — 기여도 강탈처럼 표시 점수만 움직이고 FN ·
  수익 · 정산은 그대로. 후원으로 SOLD OUT된 슬롯은 되돌릴 수 없음. See docs/figma/code-first-screens.md
- 시그니처 두산 (2026-10-24, 기본값 — 일반적인 기준, StreamDonate 참고): 참고 자료가 한 줄뿐이라 "고른 시그를 낮은 금액부터 한 단씩
  올리는 사다리 레이스"로 해석함(원본 롤러 연출 · 규칙은 TBD). 다음 단의 시그니처 후원만 올리고 건너뛰기 없음, 먼저 꼭대기에 오른 줄이
  이기고 끝남(개인전 2등 이하 · 계속 진행은 없음). 완주 보너스 기본 0점, 완주한 후원의 멤버에게만. 단마다 점수는 없음. VS는 팀 배틀
  방송의 A팀 / B팀, 숨긴 시그니처는 사다리에 넣지 않음. See docs/figma/code-first-screens.md
- 알파벳 모으기 (2026-10-24, 기본값 — 일반적인 기준, StreamDonate 참고): 단어는 영문 A–Z 2 ~ 12자, 꽝 비율 기본 50%, 나머지는
  단어의 글자마다 똑같이(이미 모은 글자도 나옴 → 중복). 멤버를 고른 시그니처 후원마다 한 번(멤버 없는 후원은 수동). 완성하면 상품
  하나를 가중치로 추첨, 상품 점수는 완성한 멤버에게만. 완성 뒤에는 다음 글자부터 새로 모음. 단어를 바꾸면 진행이 모두 초기화. 한글
  단어 · 글자별 확률 직접 지정은 TBD. See docs/figma/code-first-screens.md
- 고스톱 (2026-10-24, 기본값 — 일반적인 기준, StreamDonate 참고): 풀은 크루 하나(방송마다 새로), 적립률 기본 100%. STOP 확률은
  참고 자료의 원화 대신 후원 점수 1,000점당 %(기본 0.05%, 최대 50% — 참고 자료의 예시 값). STOP 배수는 고정 값(기본 ×1, GO 횟수에
  따라 늘지 않음 — TBD). STOP한 멤버가 풀 전부를 가져감. 멤버를 고르지 않은 후원은 자동으로 굴리지 않음. 색 구간 기본 없음. 랭킹은
  방송 안의 STOP 합계 점수순. See docs/figma/code-first-screens.md
- 땅따먹기 (2026-10-24, 기본값 — 일반적인 기준, StreamDonate 참고): 기본 8×8, 하트는 후원 점수 1,000점마다 1개(시그니처 · 일반
  후원 모두, 멤버를 고른 후원만), 칸 하나에 하트 1개 — 빈 칸이든 빼앗기든 같음. 칸 점수 기본 0(순위만), 있으면 그때 설정값만큼 옮김.
  새 판은 하트 0부터. 칸 비우기 · 할당 취소는 없음(새 판으로 다시 시작). 하트 단위(원화 · 플랫폼 하트 환산), 롤링 연출은 TBD.
  See docs/figma/code-first-screens.md
- 스도폴리 (2026-10-24, 기본값 — 일반적인 기준, StreamDonate 참고): 판은 2D 정사각(칸 4의 배수), 기본 판 없음("예시 판으로 채우기"의
  20칸 · 황금열쇠 7장은 예시 값). 기본 금액 구간 0 FN 이상 1번, 출발 보너스 0, 무인도 1번 쉬기, 목표 바퀴 없음. 출발 보너스는 지나칠
  때마다(도착 포함), 출발로 카드도 한 바퀴로 침. 더블이면 한 번 더(무인도 탈출 더블은 제외), 세 번 연속 더블은 무인도. 카드로 옮긴 칸의
  효과는 없음. 공용 말이면 점수는 굴린 후원의 멤버에게. 3D 보드 · BJ 캐릭터는 TBD. See docs/figma/code-first-screens.md
- 마블 룰렛 (2026-10-24, 기본값 — 일반적인 기준, StreamDonate 참고): 무료(FN · 점수 · 정산 없음). 최소 4명(StreamDonate 기준) · 최대 50명
  (기본 50), 명령어 기본 `!참여`(같거나 "명령어 + 띄어쓰기"로 시작), 플랫폼 계정별 한 번, 레이스 기본 20초 · 3초 카운트다운, 스킬은 연출만
  (순위 변화 없음). 물리 엔진 없이 서버가 순서를 정함. 설정은 참가 모집 시작 때 그 판에 고정. 초대 링크는 판마다 새로 만들고 레이스
  시작 때 끝남. 도우미(매니저) 페이지 · 채팅 참가 조건(구독 · 팔로우) · 당첨 상품 · 3D 맵은 TBD. See docs/figma/code-first-screens.md
- 로얄 럼블 (2026-10-24, 기본값 — 일반적인 기준, StreamDonate 참고): 무료(FN · 점수 · 정산 없음). 사람 최소 2명 · 최대 50명(기본 50),
  봇 채우기 기본 10명(최대 30), 봇은 우승하지 않음(우승자는 사람 중 균등 추첨), 배틀 기본 45초 · 3초 카운트다운, 링 축소(1/4 · 1/2 지점)
  · 서든데스(마지막 1/5) 기본 켬. AI · 물리 대신 서버가 탈락 순서 · 시간 · 가해자(또는 링 밖)를 정하고 OBS는 연출만. 명령어는 마블
  룰렛과 같은 규칙(두 게임을 같은 명령어로 동시에 모집하면 한 채팅이 둘 다 참가). 설정은 참가 모집 시작 때 그 판에 고정. 초대 링크(VIP)
  · 체력 · 무기 · 캐릭터 · 우승 상품 · 조작형(참여자 링크의 조이스틱 · 키보드 실시간 입력)은 TBD. See docs/figma/code-first-screens.md
- 원소스 오버레이 배치 (2026-10-24, 기본값 — 일반적인 기준, StreamDonate 참고): 캔버스 PC 1920 × 1080 · 모바일 가로 1280 × 720 · 세로
  1080 × 1920, 캔버스당 20개, 스케일 10 ~ 400%, 위치 ±3840px. 원소스 페이지는 각 오버레이를 자기 주소의 프레임으로 띄움(오버레이마다의
  설정 · 테마 · 리모컨 ON/OFF를 그대로 씀), 배치 반영은 5초 안. 캔버스별 저장 · 다른 탭과 겹치면 거절. 표시 시간(일정 시간만 보이기) ·
  오버레이별 폰트 · 크루 점수 게임 오버레이(`?spin` 등) 넣기 · 도우미(helper) 화면 · OBS 씬 파일에 원소스 넣기는 TBD.
  See docs/figma/code-first-screens.md
- 커스텀 오버레이 (2026-10-24, 기본값 — 일반적인 기준, StreamDonate 참고): 슬롯 5개, HTML · CSS · JS 각 20,000자, 데이터는 후원 알림 ·
  통합 채팅 두 가지(처음 채팅 20줄). 크리에이터 코드는 불투명 출처 샌드박스(속성 + 헤더 CSP `sandbox allow-scripts`)에서만, 외부 요청
  (`connect-src 'none'`) · 폼 · 팝업 · 프레임 막음, 이미지 · 미디어 · 글꼴은 https 허용. 실제 서비스는 샌드박스를 사이트와 다른 도메인에
  두는 것도 검토(TBD). 외부 API 허용 목록 · 오버레이마다(후원 알림 등) 커스텀 · 목표/랭킹 등 다른 데이터 · 코드 검사/신고 · 도우미 화면 ·
  원소스 배치에서 슬롯 2~5 고르기는 TBD. See docs/figma/code-first-screens.md
- 채팅봇 명령어 (2026-10-24, 기본값 — 일반적인 기준, StreamDonate (DallaHelper) 참고): 기본 꺼짐, 명령어 30개 · !로 시작 2~20자 · 응답
  200자, 쿨다운 기본 30초(명령어 × 플랫폼), 1분 20번, `!명령어` 목록 기본 켬, 변수 {nickname} · {platform}. 채팅 보내기를 지원하는
  플랫폼(지금 mock에서는 YouTube · 치지직)에서만 답함. 봇은 통합 채팅을 읽을 때 돌아서, 아무 화면도 채팅을 읽지 않으면 답이 늦음 —
  실제 서비스는 채팅 이벤트를 받는 작업자에서 돌려야 함(TBD). 정기 메시지(타이머) · 명령어 인자 · 시청자 개인 쿨다운 · 봇 전용 계정 ·
  도우미 · 매니저 채팅창에서 관리는 TBD. See docs/figma/code-first-screens.md

Still TBD:

- Backend framework
- Database
- Payment provider
- FN packages
- FN/fiat conversion
- Creator revenue share
- Platform commission
- Game prizes (decided 2026-10-04: 룰렛 · 뽑기 wins are creator goods, never FN; the server draws and the overlay shows the result — built, see docs/domains/donation.md. 럭키박스 and the quiz donations were removed the same day. 2026-10-08: the 1인 한도 counts per person over one Korean day (KST). Odds disclosure / legal review still TBD)
- Vote pricing (decided 2026-10-04: free only — one vote per signed-in viewer, no FN; 2026-10-08: once per person by the verified phone, also across 재가입; see docs/domains/vote.md)
- Event participation (decided 2026-10-08: once per event per person by the verified phone, like 출석; rewards and winners decided the same day — see Confirmed and docs/domains/events.md. Still TBD: eligibility, 경품 고시 · 제세공과금, how a prize is delivered)
- Refund policy (decided 2026-10-04: a failed or creator-canceled 퀘스트 후원 refunds the whole amount, and a quest past its time limit waits for a decision — see docs/domains/donation.md. 2026-10-08: FN charge refunds have **defaults — 기본값 (일반적인 기준, 법무 검토 전)**: 7일 이내 · 미사용 = 전액 취소 (2026-10-13: a charge confirmed later counts from the confirmation), otherwise the unused paid FN minus a 10% fee (rounded down), used and free FN not refundable, free FN then oldest charge spent first, target 접수 후 3영업일 이내 처리 — see docs/domains/wallet.md "환불 정책". 2026-10-08: the KRW amount of a partial refund is decided (see Confirmed). Still TBD: legal review, KRW refund per payment method / payment provider, donation refunds other than quests. The 초안 `/terms/refund` (FN 충전 · 환불 정책) and 서비스 이용약관 제9조 state the same defaults.)
- Terms and policies (2026-10-06: clause headings only. 2026-10-08: full 초안 bodies for the 7 documents — service, privacy, youth, operation, marketing, creator, refund — under the draft banner, 시행일 "정식 오픈일 (TBD)", 버전 "초안 v0.1"; see `apps/web/src/features/terms/drafts`. Still TBD: legal review, 사업자 정보 (상호 · 대표자 · 사업자등록번호 · 주소 · 연락처), 개인정보 보호책임자 · 청소년 보호 책임자, 처리 위탁 · 제3자 제공 업체 (PG · SMS · 본인인증 · TTS · cloud), 국외 이전, sanctions per report reason and the appeal channel. Privacy retention defaults: 계약 · 청약철회 · 결제 · 정산 기록 5년, 문의 · 신고 3년, 접속 기록 3개월, 본인 확인 값 탈퇴 후 1년, 그 밖 탈퇴 즉시 파기 — to match `services/account/retentionPolicy.ts`)
- Charges in progress (since 2026-10-10): how the payment provider confirms a 처리중 charge (webhook · status lookup) and
  when 처리중 ends (until then operators decide it in 처리 중 충전, 2026-10-12); what happens to the KRW of a charge whose
  payment completed after its account withdrew (PG 취소 · 환불 — the console only lists it); legal review of the 청약철회
  period of a charge confirmed later (기본값 since 2026-10-13: from the confirmation, see Confirmed)
- Chargeback policy
- Settlement schedule
- Settlement minimum
- Identity verification (decided 2026-10-06: 정산 신청 requires the 마이페이지 본인인증 — see docs/domains/settlement.md; the provider still TBD)
- Phone verification (decided 2026-10-08, 기본값: 5 wrong codes invalidate the code, a code lives 3 minutes (180 s), a verified phone must be used within 30 minutes — `services/auth/verificationCore.ts`; the SMS provider and send rate limits still TBD)
- Retention of withdrawal records and withdrawn members' data (defaults since 2026-10-08, labelled "기본값 (일반적인 기준, 법무 검토 전)": 계약 · 청약철회 기록 5년, 대금결제 · 재화 공급 기록 5년, 소비자 불만 · 분쟁 처리 기록 3년, 접속 기록 3개월, 부정 이용 방지용 본인 확인 값 탈퇴 후 1년, 게시물 삭제하지 않음 — counted from the withdrawal; one list in `apps/web/src/services/account/retentionPolicy.ts`, see docs/domains/wallet.md. Legal review, the start point and the retention of active members' access logs still TBD)
- Age restriction
- Tax/accounting treatment
- Exact external API capabilities
- 후원 내역 이관 (2026-10-16 request, built with **기본값 (TBD) — pending the user's confirmation**, docs/domains/donation-import.md):
  the creator imports donations they received on 투네이션 (CSV upload) or FlexTV (linked account); imported records show with
  their source only in 후원관리+ › 내역 이관 (creator-only) and add their own rows, in 원, to the 수단별 보드; they never count
  toward 회원 누적 / 활동 등급, 크리에이터 칭호, FN 후원자 랭킹, 수익 or 정산 and never move FN, wallets or earnings; unlinking
  FlexTV keeps them (되돌리기 per sync batch). Still TBD: matching donor nicknames to Ssumnation members, a KRW ↔ FN rate, the real
  투네이션 export format (columns, encoding, whether 취소 / 환불 rows appear), the CSV limits (sample 5 MB · 20,000 rows), FlexTV's
  history API (paging, how far back, unit, rate limits, auth) and overlap with 후원 연동 events, re-importing after 되돌리기 of a
  FlexTV batch, retention of imported records while the account is active (deleted at 탈퇴), whether 내역 이관 belongs on the 도우미
