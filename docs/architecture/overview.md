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
     ├── SOOP
     └── CHZZK
```

## Response headers

`apps/web/next.config.ts` (기본값 — 일반적인 기준, 2026-10-18; tested in `src/lib/securityHeaders.test.ts`):

- Every path: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy: camera=(), microphone=(), geolocation=()`, HSTS in production, no `X-Powered-By`.
- Every path except the OBS overlays (`/overlay/*`): `X-Frame-Options: SAMEORIGIN` and
  `Content-Security-Policy: frame-ancestors 'self'; object-src 'none'; base-uri 'self'` — only the site itself (the
  studio's 오버레이 미리보기) may frame its pages; overlays stay loadable by any streaming tool.
- `X-Robots-Tag: noindex, nofollow` on the studio, overlays, pop-out windows, my page, wallet and API routes (the 도우미
  host is noindex through its layout metadata).
- A full Content-Security-Policy (scripts, images, embeds) waits for the real embeds and payment provider (TBD).
  The admin console has its own strict headers (`apps/admin/next.config.ts`).
