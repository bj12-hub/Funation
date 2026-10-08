# Ssumnation Claude Development Rules

## 1. Project

Ssumnation is a broadcasting donation platform.

Confirmed external broadcasting platforms:

- YouTube
- FlexTV
- SOOP
- CHZZK (치지직, added 2026-10-01 for unified chat and donation alerts)

Frontend:

- Next.js
- TypeScript

Runtime:

- Node.js

Backend framework and database are not finalized yet.

---

## 2. Source of Truth

Use the following order:

1. Figma product/design specification
2. `README.md`
3. `docs/`
4. Existing source code

Do not invent undocumented product rules.

---

## 3. Frontend Rules

The frontend uses:

```text
Next.js + TypeScript
```

Use the Next.js App Router.

Frontend structure:

```text
apps/web/src/
├── app/
├── components/
├── features/
├── hooks/
├── lib/
├── services/
├── types/
└── styles/
```

Prefer feature-oriented organization.

Do not put all business logic into `components/`.

---

## 4. Figma Implementation

Before implementing a screen:

1. identify the Figma frame,
2. identify the user role,
3. identify the route,
4. identify the state,
5. identify reusable components,
6. identify API/data requirements.

Common UI states:

```text
DEFAULT
LOADING
EMPTY
ERROR
DISABLED
PROCESSING
SUCCESS
```

These are product states and should be represented intentionally.

---

## 5. App Router

Use route groups where appropriate.

Recommended initial organization:

```text
src/app/
├── (public)/
├── (auth)/
├── creator/
├── wallet/
├── donation/
└── admin/
```

Do not force every Figma page into a separate business domain.

---

## 6. Roles

Expected roles:

- Supporter
- Creator
- Admin

Authorization must eventually be enforced by the backend.

Frontend route protection is not a substitute for server-side authorization.

---

## 7. Financial Domain

Keep these separate:

- Payment
- FN Currency
- Wallet
- Wallet Transaction
- Donation Order
- Donation Event
- Creator Earnings
- Settlement

Never treat client-side balance as authoritative.

Never calculate final financial state only in the browser.

---

## 8. Transaction Security

The Figma Developer Handoff defines:

- Transaction ID
- External Transaction ID
- Idempotency Key

Financial mutations must support deterministic retry behavior and duplicate prevention.

---

## 9. Platform Integrations

Confirmed:

```text
YouTube
FlexTV
SOOP
CHZZK
```

Recommended backend abstraction:

```text
PlatformAdapter
├── YouTubeAdapter
├── FlexTVAdapter
├── SoopAdapter
└── ChzzkAdapter
```

Never expose external platform DTOs directly to the core donation domain.

Do not assume all platforms have identical API capabilities.

---

## 10. Donation Types

Current product/Figma scope includes:

- Text
- Mini
- Video
- Signature
- Wishlist
- Quest
- Drawing
- Roulette
- Gacha (뽑기)

LuckyBox and Quiz were removed on 2026-10-04 (product decision).

Do not duplicate financial logic for each donation type.

Use a shared Donation Core with type-specific behavior.

---

## 11. Secrets

Never commit:

- `.env`
- API keys
- OAuth secrets
- database credentials
- payment credentials
- private keys

Only commit `.env.example` with placeholder values.

---

## 12. Git

Branch examples:

```text
main
develop
feature/*
fix/*
refactor/*
docs/*
```

Commit prefixes:

```text
feat:
fix:
refactor:
docs:
test:
chore:
```

Examples:

```text
feat: add creator dashboard shell
feat: add fn wallet page
feat: add donation history
feat: add youtube integration contract
fix: prevent duplicate donation submission
```

---

## 13. PR Requirements

PRs should include:

- purpose
- Figma reference
- route
- role
- domain
- platform, if applicable
- files changed
- tests
- unresolved issues

---

## 14. Do Not Invent Business Rules

Use `TBD` for undefined rules.

Do not invent:

- FN exchange rate
- creator revenue share
- platform fee
- refund policy
- chargeback policy
- settlement schedule
- settlement minimum
- payment provider
- tax rules
- identity verification
- age restrictions

---

## 15. Implementation Procedure

For each feature:

1. identify requirement,
2. locate Figma frame,
3. identify route,
4. identify role,
5. identify state,
6. inspect existing implementation,
7. reuse components where possible,
8. implement,
9. test,
10. document assumptions.

Avoid unrelated refactoring.

---

## 16. Definition of Done

UI features should consider applicable:

- default
- loading
- empty
- error
- disabled
- processing
- success

Financial features additionally require review of:

- authorization
- duplicate request
- retry
- idempotency
- server validation
- auditability

Platform features additionally require review of:

- authentication
- API failure
- timeout
- retry
- unsupported capability
- external event duplication
- response mapping
