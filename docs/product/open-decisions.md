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
  once per result, the current account only. Push · e-mail and other triggers stay TBD
- 회원 탈퇴 and 플랫폼 후원 (2026-10-09): refused while a 플랫폼 후원 of the account still waits for its result (FN held);
  a failed one's returned FN reads "FN 반환", not 환불완료, in the FN 내역, its CSV, the FN Wallet and the console's 후원
  운영. See docs/domains/integrations.md and wallet.md
- FN Wallet type "FN 반환" (2026-10-09): the (+) row of a failed 플랫폼 후원's returned FN has its own type chip and filter
  (`?kind=RETURN`), not 환불; real refunds stay 환불. See docs/domains/wallet.md "FN Wallet 목록 유형"
- Console refund card (2026-10-09): a refund that differs from the request's says which way — "요청 후 FN 사용으로
  줄어듦" or "요청 후 FN이 돌아와 늘어남"; equal stays "요청 때와 같아요". The same direction applies to the member's
  approved-refund note ("요청 후 FN을 사용해 / FN이 돌아와 환불 금액이 바뀌었어요 (요청 때: …).") and the console's
  approval error ("요청 후 FN 사용으로 / FN이 돌아와 환불 금액이 바뀌었어요. …"). See docs/domains/wallet.md
- Event result after 탈퇴 (2026-10-09): a participant skipped as 지급 불가 who is back with a 재가입 account sees "탈퇴한
  계정으로 참여해 보상 대상에서 빠졌어요" (draw and 무상 FN alike), with no notification. See docs/domains/events.md
- Crew broadcast donor names (2026-10-09): on-stream views use the name after the creator's 대체 메시지 rules (익명 or the
  대체 문구), fixed when the donation was sent; the creator's own 방송 운영 후원 리스트 keeps the name as sent. See
  docs/domains/donation.md

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
- Refund policy (decided 2026-10-04: a failed or creator-canceled 퀘스트 후원 refunds the whole amount, and a quest past its time limit waits for a decision — see docs/domains/donation.md. 2026-10-08: FN charge refunds have **defaults — 기본값 (일반적인 기준, 법무 검토 전)**: 7일 이내 · 미사용 = 전액 취소, otherwise the unused paid FN minus a 10% fee (rounded down), used and free FN not refundable, free FN then oldest charge spent first, target 접수 후 3영업일 이내 처리 — see docs/domains/wallet.md "환불 정책". 2026-10-08: the KRW amount of a partial refund is decided (see Confirmed). Still TBD: legal review, KRW refund per payment method / payment provider, donation refunds other than quests. The 초안 `/terms/refund` (FN 충전 · 환불 정책) and 서비스 이용약관 제9조 state the same defaults.)
- Terms and policies (2026-10-06: clause headings only. 2026-10-08: full 초안 bodies for the 7 documents — service, privacy, youth, operation, marketing, creator, refund — under the draft banner, 시행일 "정식 오픈일 (TBD)", 버전 "초안 v0.1"; see `apps/web/src/features/terms/drafts`. Still TBD: legal review, 사업자 정보 (상호 · 대표자 · 사업자등록번호 · 주소 · 연락처), 개인정보 보호책임자 · 청소년 보호 책임자, 처리 위탁 · 제3자 제공 업체 (PG · SMS · 본인인증 · TTS · cloud), 국외 이전, sanctions per report reason and the appeal channel. Privacy retention defaults: 계약 · 청약철회 · 결제 · 정산 기록 5년, 문의 · 신고 3년, 접속 기록 3개월, 본인 확인 값 탈퇴 후 1년, 그 밖 탈퇴 즉시 파기 — to match `services/account/retentionPolicy.ts`)
- Chargeback policy
- Settlement schedule
- Settlement minimum
- Identity verification (decided 2026-10-06: 정산 신청 requires the 마이페이지 본인인증 — see docs/domains/settlement.md; the provider still TBD)
- Phone verification (decided 2026-10-08, 기본값: 5 wrong codes invalidate the code, a code lives 3 minutes (180 s), a verified phone must be used within 30 minutes — `services/auth/verificationCore.ts`; the SMS provider and send rate limits still TBD)
- Retention of withdrawal records and withdrawn members' data (defaults since 2026-10-08, labelled "기본값 (일반적인 기준, 법무 검토 전)": 계약 · 청약철회 기록 5년, 대금결제 · 재화 공급 기록 5년, 소비자 불만 · 분쟁 처리 기록 3년, 접속 기록 3개월, 부정 이용 방지용 본인 확인 값 탈퇴 후 1년, 게시물 삭제하지 않음 — counted from the withdrawal; one list in `apps/web/src/services/account/retentionPolicy.ts`, see docs/domains/wallet.md. Legal review, the start point and the retention of active members' access logs still TBD)
- Age restriction
- Tax/accounting treatment
- Exact external API capabilities
