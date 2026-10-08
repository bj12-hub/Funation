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
- Refund policy (decided 2026-10-04: a failed or creator-canceled 퀘스트 후원 refunds the whole amount, and a quest past its time limit waits for a decision — see docs/domains/donation.md; other refunds still TBD)
- Chargeback policy
- Settlement schedule
- Settlement minimum
- Identity verification (decided 2026-10-06: 정산 신청 requires the 마이페이지 본인인증 — see docs/domains/settlement.md; the provider still TBD)
- Retention of withdrawal records and withdrawn members' data (defaults since 2026-10-08, labelled "기본값 (일반적인 기준, 법무 검토 전)": 계약 · 청약철회 기록 5년, 대금결제 · 재화 공급 기록 5년, 소비자 불만 · 분쟁 처리 기록 3년, 접속 기록 3개월, 부정 이용 방지용 본인 확인 값 탈퇴 후 1년, 게시물 삭제하지 않음 — counted from the withdrawal; one list in `apps/web/src/services/account/retentionPolicy.ts`, see docs/domains/wallet.md. Legal review, the start point and the retention of active members' access logs still TBD)
- Age restriction
- Tax/accounting treatment
- Exact external API capabilities
