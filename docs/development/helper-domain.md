# Ssumnation 도우미 (helper domain)

2026-10-14 결정: the creator's OBS (방송 화면) features and the 리모컨 open first on their own domain, as
**Ssumnation 도우미** — a feature site like the legacy FlexTV 도우미 (`docs/research/flextv-livehelper.md`): a left menu of
feature pages, the 리모컨 button at the bottom. The rest of the site (wallet, donation pages, settlement, community …)
stays on the site's domain.

Decisions (AskUserQuestion, all recommended options):

| Question | Decision |
|---|---|
| Structure | **Same app (`apps/web`) + host routing** — not a separate `apps/helper`. Accounts, widget settings and overlay keys are the site's. |
| Brand | **Ssumnation 도우미** — site logo and colors, the name is one constant (`features/helper/helperNav.ts` `HELPER_BRAND`). |
| Accounts on the helper domain | **Sign-in, sign-up, password reset and 채널 만들기** — creators can start there before the site opens. |

The real domain is **TBD**; nothing in code depends on it.

```
https://<site domain>      apps/web  site (the helper pages are not served here)
https://<helper domain>    apps/web  Ssumnation 도우미 (same deployment, Host decides)
https://admin.<site domain> apps/admin console (docs/development/admin-subdomain.md)
```

## How a request is routed

`apps/web/src/middleware.ts` + `src/lib/helperRouting.ts` (pure, tested in `helperRouting.test.ts`).

A request is for the helper when its `Host` — or the first `X-Forwarded-Host` — is a helper host: one listed in
`HELPER_HOST`, or, with `HELPER_HOST` unset, any `helper.` host. (Next renders a server action's redirect target through
an internal request to `localhost` that carries the public host only in `X-Forwarded-Host`.)

On the helper host:

| Request | Result |
|---|---|
| `/`, `/chat`, `/tools` … | rewritten to `/helper/…` (`app/helper/*`); unknown paths → the helper's 404 |
| `/overlay/*`, `/popout/*`, `/login`, `/signup`, `/password-reset`, `/channel/new`, `/terms/*`, `/api/media/*`, `/api/custom-sound/*`, files | served as on the site |
| `/creator/*` (links inside the reused studio screens) | 307 to the helper page: `/creator/widgets/tools` → `/tools`, `/creator/donations?tab=filtering&sub=…` → `/filtering?sub=…`, studio pages the helper does not have → `/` |
| `/helper/*` | 307 to the same path without `/helper` |
| other `/api/*` (admin, wallet, bank SMS webhook) | 404 |

On the site's host `/helper/*` is a 404 (or, with `HELPER_HOST` set, a redirect to the helper domain).

Every page request carries `x-ssumnation-surface: site | helper` (a client-sent value is overwritten). Layouts read it
with `lib/surface.ts` `getSurface()` to pick their chrome: the auth pages and `(main)` (채널 만들기, terms) get the helper's
top bar, the 404s point back to the helper, and sign-up does not offer 간편 로그인 연동 (마이페이지 is not on the helper).
It is chrome only — never an authorization input; every page and server action still checks the session and role.

## Screens

`app/helper/layout.tsx`: signed out → landing (로그인 · 회원가입, `?next=` keeps the address that was opened); signed in
without a channel → 채널 만들기; creators → the shell (`features/helper/HelperShell.tsx`): brand, profile (channel,
nickname, linked platforms, 로그아웃), the menu (`helperNav.ts`) and the 리모컨 button. Below 900px the menu is a drawer.

| Helper path | Screen (reused) |
|---|---|
| `/` | 시작하기 — OBS 연결 순서, OFF overlays, every feature (`HelperHome.tsx`) |
| `/widgets` | 위젯 catalog + popups (`WidgetSettingsScreen`) |
| `/chat` | 통합 채팅 (`UnifiedChatScreen`) |
| `/tools` | 방송 도구 (`BroadcastToolsScreen`) |
| `/signatures` · `/video` · `/drawing` · `/effects` · `/banner` | 시그니처 · 영상 · 음성 후원 · 그림 후원 · 이펙트 · 배너 |
| `/crew` · `/crew/broadcast` | 크루 관리 · 크루 방송 운영 |
| `/overlays` · `/overlays/preview/[id]` | 오버레이 주소 · 미리보기 |
| `/assets` · `/link` · `/youtube` · `/filtering` | 이미지 · 사운드 · 후원 연동 · 유튜브 연동 · 후원 필터링 |
| `/remote` | 리모컨 (`RemoteScreen`) |

## Environment

`apps/web/.env.local` (production values in the host's secret store):

```
HELPER_HOST=helper.<domain>     # comma-separated host[:port]; unset = any "helper." host
```

## Local development

Browsers resolve `*.localhost` to this machine, so with `npm run dev:sync` running the helper is at
**http://helper.localhost:3000** (the site stays at http://localhost:3000). Sign in there separately: session cookies are
host-only, so the helper domain has its own sign-in.

## Deployment notes

- The reverse proxy must pass the public host (`Host`, or `X-Forwarded-Host`), or every request looks like the site.
- Cookies stay host-only (no `Domain`), like the admin console: signing in on the helper does not sign in on the site.
- TBD: the domain itself; social sign-in (Google · Kakao) redirect URIs must list the helper domain once OAuth is real;
  the 후원 QR코드 widget must point at the donation page on the **site's** domain when the real QR is generated (today it
  is a sample image).
