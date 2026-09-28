# Donation Domain

```text
Supporter
  ↓
Wallet
  ↓
Donation Order
  ↓
Donation Event
  ↓
Creator
```

Platform-specific behavior is handled through adapters.

```text
Donation Core
    ↓
PlatformAdapter
    ├── YouTube
    ├── FlexTV
    └── SOOP
```
