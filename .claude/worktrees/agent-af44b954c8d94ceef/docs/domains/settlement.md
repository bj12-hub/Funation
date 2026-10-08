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
- **지급 완료 (decided 2026-10-08).** States: PENDING → APPROVED → PAID (or PENDING → REJECTED; PENDING → FORFEITED at a
  탈퇴). After the transfer, the operator records 지급 완료 for an APPROVED request with the 이체 참조번호 (4–40 letters, digits
  or hyphens; a digits-only value with 10 or more digits looks like an account number and is refused) and confirms. One
  console request id per payment: a retry answers OK once, with one `SETTLEMENT_PAY` audit entry. Refused for any other
  state, for 탈퇴 소멸 requests and for requests of a creator who withdrew (also an approved one — what happens to approved,
  unpaid earnings at a 탈퇴 is TBD). The creator's 정산 신청 · 정산 관리 show "지급 완료" and the 지급일 instead of the
  scheduled date; the reference stays with the operator. 승인 and 지급 완료 both count as 출금 in the studio dashboard. 지급
  수단 · 일정 · 이체 연동 are TBD.
- **Withdrawn creators in the console (decided 2026-10-08).** Requests keep the start marker of the account that made them;
  a withdrawn creator's requests show the original nickname with a "탈퇴" badge, from the 탈퇴 on and after a 재가입.
- **Request ids** are random (`st-<uuid>`), so two requests in the same millisecond never share an id.
- **정산 자료 등록** checks each document's first bytes (JPG · PNG · PDF must match the declared type, "JPG, PNG, PDF 파일만 업로드할 수 있어요."), then checks "already registered" again and writes in one synchronous step, so two tabs cannot both register.
- **본인인증 before 정산 신청 (decided 2026-10-06: "필수로 막기").** Until the creator's 마이페이지 본인인증 is done, the server refuses the 정산 신청 view, the fee quote, the request and 자동 정산 ON/OFF with `IDENTITY_REQUIRED` — no FN moves and no Idempotency-Key is reserved. Check order: session → 정산 자료 registration (`NOT_REGISTERED`) → 본인인증, in the same synchronous step as the write. The studio shows "정산 신청 전에 본인인증이 필요해요" with a link to `/mypage` (정산 신청 card, and `/creator/settlement/apply` sends unverified creators to `/creator/settlement?gate=identity`). 서류 심사 and 정산 계좌 are not separate gates: the mock approves documents on submit and every registration carries the payout account. No job makes automatic requests yet; when one exists it must re-check this gate for each request. 정산 관리 (history, 정보 변경) stays open without 본인인증. A 재가입 account starts unverified.

TBD: whether 정산 정보 변경 is allowed while a request is pending (allowed for now), the identity verification provider and whether 본인인증 must be renewed, document review, the real payout / bank transfer and all policy numbers (CLAUDE.md §14).
