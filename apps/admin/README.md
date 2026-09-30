# Somnation Admin

Separate admin console for operators (Next.js, port 3200). It has no data of its own: every read and
write goes to the site's admin API (`apps/web` → `/api/admin/*`) from the server, with a shared secret
(`ADMIN_API_TOKEN`) and the operator's identity, which the site writes to its audit log.

```bash
npm run dev:web     # site + admin API (http://localhost:3000)
npm run dev:admin   # admin console (http://admin.localhost:3200 or http://localhost:3200)
```

- Deployed on the admin subdomain (e.g. admin.<site domain>, domain TBD) — see docs/development/admin-subdomain.md.
- Environment: see `.env.example` (defaults work for local mock development; `ADMIN_HOST` restricts the host).
- Contract types: `src/types/adminApi.ts` (keep in step with `apps/web/src/services/admin/*Types.ts`).
- Operator auth (SSO / 2FA / IP allowlist), per-operator tokens and admin roles are TBD.
