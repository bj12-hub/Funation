# Admin subdomain

The admin console (`apps/admin`) is deployed on its own subdomain of the site, e.g. `admin.<site domain>`.
The real domain is not decided yet (TBD) — nothing in code depends on it; everything is configured by env.

```
https://<site domain>         apps/web    site + /api/admin/* (server-to-server only)
https://admin.<site domain>   apps/admin  operator console
```

## Isolation

| Concern | How it is handled |
|---|---|
| Cookies | Both apps set **host-only** cookies (no `Domain`). The site's member session never reaches the admin host and vice versa. In production the admin cookie is `__Host-somnation_admin` (Secure, Path=/, no Domain — enforced by the browser), SameSite=Strict, 8 h lifetime. **Never** add `Domain=.<site domain>` to either app's cookies. |
| Admin API | `/api/admin/*` on the site accepts only `Authorization: Bearer <ADMIN_API_TOKEN>` + operator headers from the admin server. No cookies, no CORS headers, so browsers cannot call it. Production without the token → 503. |
| Wrong host | `ADMIN_HOST` makes the admin app answer 404 on any other Host (bare IP, stray DNS names). |
| Headers | CSP (self + Google Fonts), `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `noindex`, HSTS in production. |
| Network (recommended) | Point `SITE_API_URL` at an internal address of the site, and restrict `/api/admin/*` at the edge to the admin server (IP allowlist / private network). Operator SSO · 2FA · IP allowlist for the console itself are TBD. |

## Environment

`apps/admin/.env.local` (production values in the host's secret store):

```
ADMIN_HOST=admin.<site domain>
SITE_API_URL=<internal site URL>
NEXT_PUBLIC_SITE_URL=https://<site domain>
ADMIN_API_TOKEN=<long random secret>
ADMIN_USE_MOCK=false        # once operator auth exists
```

`apps/web/.env.local`: `ADMIN_API_TOKEN=<same secret>`.

## Local development

Browsers resolve `*.localhost` to 127.0.0.1, so the subdomain setup can be tried locally:

```bash
npm run dev:sync     # site on http://localhost:3000
npm run dev:admin    # admin on http://admin.localhost:3200 (or http://localhost:3200)
```

To mimic production host checking locally, set `ADMIN_HOST=admin.localhost:3200` in `apps/admin/.env.local`.
