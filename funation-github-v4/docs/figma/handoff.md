# Figma Developer Handoff

Figma is the visual/product source of truth.

## Confirmed Platform Scope

- YouTube
- FlexTV
- SOOP

## Architecture

```text
FN Wallet
   ↓
Donation Core
   ↓
Platform Adapter
   ├── YouTube
   ├── FlexTV
   └── SOOP
```

## Core Concepts

- User
- Wallet
- Wallet Transaction
- Donation Order
- Donation Event
- Creator
- External Product
- External Transaction
- Settlement

## Transaction Concepts

- Transaction ID
- External Transaction ID
- Idempotency Key

## Common States

- DEFAULT
- LOADING
- EMPTY
- ERROR
- DISABLED
- PROCESSING
- SUCCESS
