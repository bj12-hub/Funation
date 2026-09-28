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
