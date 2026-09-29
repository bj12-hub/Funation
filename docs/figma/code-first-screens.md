# Code-first screens (Figma update checklist)

Since 2026-09-29 features without a Figma frame are built in code first and designed afterwards. Each screen below uses the existing tokens and components; the later Figma pass should create frames for them and then note the frame ids in `route-map.md`.

| Route / component | Built in | Notes for the Figma pass |
|---|---|---|
| `/creator` — 크리에이터 권한이 필요합니다 (`app/creator/layout.tsx`) | PR #44 | No-permission state for signed-in members without the Creator role; needs a path to "크리에이터 되기" once decided |
| `/donation/history` layout (`features/platformDonation/DonationHistoryScreen.tsx`) | PR #42 | Figma 817:8038 / 817:8223 exist but their auto-layout is broken; the built table + detail panel should replace them |
| `/wallet` FN Wallet summary + ledger (`features/wallet/WalletOverviewScreen.tsx`) | PR #43 · this PR | 817:7552 exists; the 적립 (REWARD) type is new |
| 정산 이용동의 inside the studio layout (`SettlementTermsScreen.tsx`) | PR #38 | Figma frames are standalone without chrome |

Add a row whenever a new code-first screen ships (see `docs/research/funnation-reference.md` for the planned features).
