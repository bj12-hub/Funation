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
- Event participation (decided 2026-10-08: once per event per person by the verified phone, like 출석; rewards, winners and eligibility still TBD)
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
