# Wallet Domain

```text
User
  ↓
Wallet
  ↓
Wallet Transaction
```

Wallet balance is server-authoritative.

Every balance-changing operation should be auditable and idempotent where applicable.

## 회원 탈퇴 (2026-10-04 결정)

회원 탈퇴는 남은 FN 소멸에 동의한 뒤 바로 처리됩니다.

- 동의는 화면에 보여 준 금액에 대한 것이므로, 서버는 요청에 담긴 금액과 현재 잔액이 같을 때만 처리합니다.
- 소멸된 FN과 탈퇴 시각은 탈퇴 기록으로 남습니다 (관리자 회원 상세에서 확인).
- 재시도는 요청 id로 한 번만 처리됩니다.
- 크리에이터에게 정산 가능 또는 정산 신청 중인 수익이 남아 있으면 탈퇴를 막습니다. 이 수익을 어떻게 처리할지는 TBD입니다.
- 재인증, 재가입, 기록 보관 기간은 TBD입니다.
