# Settlement Domain

```text
Donation Order
  ↓
Creator Earnings
  ↓
Settlement
  ↓
Payout
```

Settlement rules remain subject to product, financial and legal approval.

## Current behaviour (mock)

- **정산 정보 at request time.** A settlement request stores a copy of the creator's masked registration (회원 유형 · 등록자 · 예금주 · 은행 · 마스킹 계좌 · 정산 코드) when it is made, following the Figma 466:2 copy: requests already made are paid and taxed with the information of that moment. 정보 변경 (480:2) removes only the current registration; the copy on each request stays.
- **정산 심사 (admin).** Each request is reviewed and approved with its own request-time copy, not the current registration. A request without that copy cannot be approved (it can still be rejected, which releases the held earnings).
- **Creator views.** 정산 신청 · 정산 관리 history rows carry only the amounts, dates, status and — for rejected requests — the 반려 사유. The operator name, internal review memo and the registration copy stay on the server.
- **Request ids** are random (`st-<uuid>`), so two requests in the same millisecond never share an id.
- **정산 자료 등록** checks "already registered" and writes in one synchronous step, so two tabs cannot both register.

TBD: whether 정산 정보 변경 is allowed while a request is pending (allowed for now), whether 본인인증 is required before 정산 신청, document review, the real payout / bank transfer and all policy numbers (CLAUDE.md §14).
