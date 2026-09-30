# Funation

> **Service brand:** Somnation (썸네이션). User-facing text uses "Somnation" in English contexts and "썸네이션" in Korean sentences ("썸네이션 ID"). The repository, packages and code identifiers keep the name Funation.

Funation is a broadcasting donation platform connecting **Creators** and **Supporters**.

## Confirmed Platform Scope

- YouTube
- FlexTV
- SOOP

## Technology

| Area | Technology |
|---|---|
| Frontend | Next.js |
| Language | TypeScript |
| Runtime | Node.js |
| Backend | TBD |
| Database | TBD |
| Design | Figma |
| Development | Claude |
| Repository | GitHub |

## Product Architecture

```text
Supporter
   ↓
Payment
   ↓
FN Wallet
   ↓
Donation Order
   ↓
Donation Core
   ↓
Platform Adapter
   ├── YouTube
   ├── FlexTV
   └── SOOP
   ↓
Creator
   ↓
Creator Earnings
   ↓
Settlement
```

## Repository

```text
funation/
├── README.md
├── CLAUDE.md
├── .gitignore
├── package.json
│
├── docs/
│   ├── product/
│   ├── figma/
│   ├── domains/
│   ├── architecture/
│   └── development/
│
├── apps/
│   ├── web/                 # Next.js + TypeScript
│   └── api/                 # Backend - TBD
│
└── packages/
    ├── shared/
    ├── ui/
    └── config/
```

## Frontend

The frontend is confirmed as:

**Next.js + TypeScript**

The frontend should be implemented from the Figma Design System and screen specifications.

## Core Roles

- Supporter
- Creator
- Admin

## Core Domains

- Authentication
- User
- Creator
- FN Wallet
- Payment
- Donation
- Donation History
- Settlement
- Platform Integration
- Notification
- Admin

## Financial Concepts

Keep these concepts separate:

- Payment
- FN Currency
- Wallet
- Wallet Transaction
- Donation Order
- Donation Event
- Creator Earnings
- Settlement

Financial state is authoritative on the server.

## Platform Adapter

External platform APIs must be isolated:

```text
Donation Core
      ↓
PlatformAdapter
      ├── YouTubeAdapter
      ├── FlexTVAdapter
      └── SoopAdapter
```

Do not place external platform API logic directly in the Donation Core.

## Figma

Figma is the visual/product source of truth.

For UI implementation:

```text
Figma Frame
    ↓
Next.js Route
    ↓
Feature
    ↓
Reusable Component
```

Do not create unrelated UI patterns when an existing Figma component can be reused.

## Admin console

The admin console is a separate app: `apps/admin` (`npm run dev:admin`, http://localhost:3200). It reads and writes through the site's admin API (`/api/admin/*`, shared `ADMIN_API_TOKEN`). See `apps/admin/README.md`.
