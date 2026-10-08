# Open Decisions

Confirmed:

- Frontend: Next.js + TypeScript
- Platforms: YouTube + FlexTV + SOOP + CHZZK

Still TBD:

- Backend framework
- Database
- Payment provider
- FN packages
- FN/fiat conversion
- Creator revenue share
- Platform commission
- Game prizes (decided 2026-10-04: 룰렛 · 뽑기 wins are creator goods, never FN; the server draws and the overlay shows the result — built, see docs/domains/donation.md. 럭키박스 and the quiz donations were removed the same day; odds disclosure / legal review still TBD)
- Vote pricing (decided 2026-10-04: free only — one vote per signed-in viewer, no FN; 2026-10-08: once per person by the verified phone, also across 재가입; see docs/domains/vote.md)
- Event participation (decided 2026-10-08: once per event per person by the verified phone, like 출석; rewards, winners and eligibility still TBD)
- Refund policy (decided 2026-10-04: a failed or creator-canceled 퀘스트 후원 refunds the whole amount, and a quest past its time limit waits for a decision — see docs/domains/donation.md. 2026-10-08 instruction "정책 부분은 일반적으로 사용하는 로직으로 시작": the 초안 `/terms/refund` (FN 충전 · 환불 정책) and 서비스 이용약관 제9조 state defaults, marked 기본값 and not reviewed by legal — 7일 이내 · 해당 충전 미사용이면 전액 청약철회, 그 밖의 남은 유상 FN은 수수료 10% 공제, 사용한 FN · 무상 FN 환불 불가, 무상 FN 먼저 사용(유상 FN은 먼저 충전한 것부터), 접수 후 3영업일 이내, 미성년자 법정대리인 취소, 탈퇴 시 남은 FN 소멸. The text only; the refund request flow does not apply these rules in code yet. Refund method per payment method still TBD with the PG)
- Terms and policies (2026-10-06: clause headings only. 2026-10-08: full 초안 bodies for the 7 documents — service, privacy, youth, operation, marketing, creator, refund — under the draft banner, 시행일 "정식 오픈일 (TBD)", 버전 "초안 v0.1"; see `apps/web/src/features/terms/drafts`. Still TBD: legal review, 사업자 정보 (상호 · 대표자 · 사업자등록번호 · 주소 · 연락처), 개인정보 보호책임자 · 청소년 보호 책임자, 처리 위탁 · 제3자 제공 업체 (PG · SMS · 본인인증 · TTS · cloud), 국외 이전, sanctions per report reason and the appeal channel. Privacy retention defaults: 계약 · 청약철회 · 결제 · 정산 기록 5년, 문의 · 신고 3년, 접속 기록 3개월, 본인 확인 값 탈퇴 후 1년, 그 밖 탈퇴 즉시 파기 — to match `services/account/retentionPolicy.ts`)
- Chargeback policy
- Settlement schedule
- Settlement minimum
- Identity verification (decided 2026-10-06: 정산 신청 requires the 마이페이지 본인인증 — see docs/domains/settlement.md; the provider still TBD)
- Age restriction
- Tax/accounting treatment
- Exact external API capabilities
