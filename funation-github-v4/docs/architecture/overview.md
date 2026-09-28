# Architecture

## Current

```text
Next.js Web
     ↓
Backend API (TBD)
     ↓
Domain Modules
     ├── Auth
     ├── Users
     ├── Creators
     ├── Wallet
     ├── Donations
     ├── Payments
     ├── Settlements
     ├── Notifications
     ├── Integrations
     └── Admin
```

## Platform Integration

```text
Donation Core
     ↓
PlatformAdapter
     ├── YouTube
     ├── FlexTV
     └── SOOP
```
