# Somnation Admin

Separate admin console for operators (Next.js, port 3200). It has no data of its own: every read and
write goes to the site's admin API (`apps/web` → `/api/admin/*`) from the server, with a shared secret
(`ADMIN_API_TOKEN`) and the operator's identity, which the site writes to its audit log.

```bash
npm run dev:web     # site + admin API (http://localhost:3000)
npm run dev:admin   # admin console (http://localhost:3200)
```

- Environment: see `.env.example` (defaults work for local mock development).
- Contract types: `src/types/adminApi.ts` (keep in step with `apps/web/src/services/admin/*Types.ts`).
- Operator auth (SSO / 2FA / IP allowlist), per-operator tokens and admin roles are TBD.
