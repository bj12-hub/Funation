# Ssumnation

> **Service brand:** Ssumnation (썸네이션). User-facing text uses "Ssumnation" in English contexts and "썸네이션" in Korean sentences ("썸네이션 ID"). The repository, packages and code identifiers keep the name Ssumnation.

Ssumnation is a broadcasting donation platform connecting **Creators** and **Supporters**.

## Confirmed Platform Scope

- YouTube
- FlexTV
- SOOP
- CHZZK (치지직)

## Technology

| Area | Technology |
|---|---|
| Frontend | Next.js |
| Language | TypeScript |
| Runtime | Node.js |
| Backend | FLEXTV's existing API, connected area by area (2026-10-25, `docs/development/flextv-backend.md`) |
| Database | FLEXTV's (behind its API) |
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
   ├── SOOP
   └── CHZZK
   ↓
Creator
   ↓
Creator Earnings
   ↓
Settlement
```

## Repository

```text
ssumnation/
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
│   ├── web/                 # Next.js + TypeScript (site, studio, OBS overlays, admin API)
│   ├── admin/               # Next.js admin console (separate app, port 3200)
│   └── api/                 # Backend - TBD (placeholder README only)
│
└── packages/                # placeholders (README only) until code is shared between apps
    ├── shared/
    ├── ui/
    └── config/
```

## Apps and hosts

| What | App | Local address | Notes |
|---|---|---|---|
| Site + creator studio (`/creator/*`) + OBS overlays (`/overlay/*`) | `apps/web` | http://localhost:3000 | also serves the admin API `/api/admin/*` |
| Ssumnation 도우미 (OBS 송출 · 리모컨 only) | `apps/web`, routed by host | http://helper.localhost:3000 | `HELPER_HOST` picks the production host; see `docs/development/helper-domain.md` |
| Admin console | `apps/admin` | http://localhost:3200 | no data of its own; talks to `/api/admin/*` with `ADMIN_API_TOKEN` (`apps/admin/README.md`) |

## Running locally

```bash
npm install
npm run dev:web      # site + studio + overlays + admin API, port 3000
npm run dev:admin    # admin console, port 3200
npm run dev:sync     # Windows: dev server that keeps pulling origin/preview (scripts/dev-sync.ps1)
npm run test:web     # Vitest (also test:admin)
npm run lint:web     # ESLint (also lint:admin)
npm run build:web    # production build (also build:admin)
```

Copy `apps/web/.env.example` and `apps/admin/.env.example` to `.env.local` when you need real keys; never commit
`.env` files or secrets.

## Mock backend

There is no backend yet. Everything under `apps/web/src/services` runs against an in-memory mock (`lib/mock.ts`
`USE_MOCK`, on outside production builds) kept on `globalThis.__ssumnationMock*`, so the state resets whenever the dev
server restarts. Each service states the server-side rules the real backend must keep (session checks, idempotency
keys, audit records, KST day boundaries); `docs/architecture/api-contract.md` lists them per domain.

## Documentation map

- `docs/product/open-decisions.md` — confirmed decisions, 기본값 (일반적인 기준) defaults and what is still TBD
- `docs/domains/*.md` — rules per domain (wallet, donation, settlement, payment, community, events, donation import …)
- `docs/architecture/api-contract.md` — mock → backend contract; `information-architecture.md` — menus and routes
- `docs/figma/*` — Figma files, frames per screen (`site-design-system.md`) and screens built code-first
  (`code-first-screens.md`)
- `docs/development/*` — workflow, helper and admin hosts, i18n, handoff notes, the FLEXTV backend (`flextv-backend.md`)

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
      ├── FlexTvAdapter
      ├── SoopAdapter
      └── ChzzkAdapter
```

Adapters live in `apps/web/src/services/platforms/adapters.ts`; each declares its capabilities, since the platforms' APIs differ.

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
