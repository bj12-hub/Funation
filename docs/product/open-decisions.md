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
- Refund policy (decided 2026-10-04: a failed or creator-canceled 퀘스트 후원 refunds the whole amount, and a quest past its time limit waits for a decision — see docs/domains/donation.md. 2026-10-08: FN charge refunds have **defaults — 기본값 (일반적인 기준, 법무 검토 전)**: 7일 이내 · 미사용 = 전액 취소, otherwise the unused paid FN minus a 10% fee (rounded down), used and free FN not refundable, free FN then oldest charge spent first, target 접수 후 3영업일 이내 처리 — see docs/domains/wallet.md "환불 정책". Still TBD: legal review, KRW refund per payment method / payment provider, the KRW amount of a partial refund, donation refunds other than quests)
- Chargeback policy
- Settlement schedule
- Settlement minimum
- Identity verification (decided 2026-10-06: 정산 신청 requires the 마이페이지 본인인증 — see docs/domains/settlement.md; the provider still TBD)
- Age restriction
- Tax/accounting treatment
- Exact external API capabilities
