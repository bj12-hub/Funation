# Payment Domain

```text
Fiat Payment
  ↓
FN Issuance
  ↓
Wallet Transaction
```

Payment provider is TBD.

Client-side payment completion is never authoritative by itself.

## Charge in progress and late completion (2026-10-10 결정)

- A charge is in progress while its payment provider call runs and while its status is 처리중 (PROCESSING), waiting for
  the payment to be confirmed. 회원 탈퇴 is refused while the account has one (`CHARGE_PENDING`), see wallet.md 회원 탈퇴.
- FN issuance lands only on the account that made the charge while it still holds the slot, active. A payment that
  completes after that account withdrew issues no FN to anyone — not the withdrawn account, not a 재가입 account — and is
  kept for the console (결제 · 환불: 완료 · FN 미지급 (탈퇴)). The KRW of such a payment (PG 취소 · 환불) is **TBD**.
- A charge started for an account that has already withdrawn (its session was read before the withdrawal) is refused
  before anything goes to the payment provider.
- Server-only cores: `services/wallet/inFlightCore.ts` (credits on their way, per account) and
  `services/wallet/chargeCore.ts` (`pendingCharges`, `confirmChargePayment` for a 처리중 charge's confirmation,
  `recordUncreditedCharge`). The mock has no confirmation path for a 처리중 charge (no provider webhook or status
  lookup, no console action); only the sample's ch1 is 처리중 — see wallet.md "충전 진행 중".

## Retry keys

- `requestCharge`'s Idempotency-Key is kept per member (`memberKeyOf`, lib/records.ts): another member sending the same
  key gets a charge of their own, the same member's retry gets the first result, and a different request under the
  member's key is `CONFLICT`. A 재가입 moves the withdrawn account's keys to its own `…-wN` id.
