# FLEXTV backend (썸네이션 화면 + FLEXTV 서버)

2026-10-25 결정: Ssumnation becomes the face of FLEXTV. Ssumnation's screens (`apps/web`) run on FLEXTV's existing
backend — its members, 렉스 ledger, payment providers, settlement and broadcasting — instead of a new backend. FLEXTV's
broadcasting is part of Ssumnation. The mock services are replaced area by area, behind a switch.

| Question | Decision |
|---|---|
| Direction | **Ssumnation's screens on FLEXTV's server.** FLEXTV's own web UI is not restyled; its API is the backend. |
| Money | **FLEXTV's 렉스 ledger as it is** — charging, balance, payment providers, refunds and settlement follow FLEXTV's rules. The name shown on screen (렉스 / FN) is TBD. |
| Members | **Existing FLEXTV members carry over**: they sign in with their FLEXTV 아이디; new members are FLEXTV members. |
| Watching | **Inside Ssumnation** (`/live`, `/creators/[id]`) with FLEXTV's player and chat. |

## Phases

| # | Area | Status |
|---|---|---|
| 1 | 로그인 · 회원가입 · 세션 · 간편 로그인 | **this document** |
| 2 | 렉스 충전 · 지갑 (FLEXTV's checkout and payment providers; charge where a donation runs short) | not started |
| 3 | 후원 (FLEXTV's TTS · video · sound · signature · mission donations first) | not started |
| 4 | 방송 목록 · 시청 · 채팅 | not started |
| 5 | 크리에이터 스튜디오 · 방송 설정 · 수익 · 정산 | not started |
| 6 | Ssumnation-only features (룰렛 · 뽑기 · 위시리스트 · 그림 · 미니 후원 · 크루 게임 …) on new FLEXTV endpoints | not started |

Until its phase, an area keeps its mock: in `next dev` the site mixes a real FLEXTV member with sample data (마이페이지,
wallet, header balance); a production build of phase 1 is for a staging environment only.

## Settings (`apps/web/.env.example`)

| Variable | Meaning |
|---|---|
| `NEXT_PUBLIC_AUTH_BACKEND=flextv` | Turns phase 1 on (`lib/flextv/mode.ts`). Unset: the mock. |
| `FLEXTV_API_URL` | FLEXTV's API server (`server/` of FLEXTV's web repository), e.g. its stage. Server-side calls only — the browser never calls FLEXTV, so no CORS entry is needed. |
| `FLEXTV_SITE_CODE` | Optional `x-site-code`. Unset = FLEXTV's own members (the decision above); a tenant code would scope sign-ups to that tenant. |
| `NEXT_PUBLIC_FLEXTV_WEB_URL` | FLEXTV's site for flows not connected yet (비밀번호 찾기). Default `https://www.flextv.co.kr`. |
| `KAKAO_REST_API_KEY` · `KAKAO_CLIENT_SECRET` (optional) | FLEXTV's Kakao app. |
| `NAVER_CLIENT_ID` · `NAVER_CLIENT_SECRET` | FLEXTV's Naver app. |
| `GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET` | FLEXTV's Google client. |

A provider without its settings is not offered on the login screen.

## API mapping (phase 1)

Code: `apps/web/src/lib/flextv/` (`client.ts` calls, `auth.ts` mapping, `tokens.ts` cookies, `social.ts` 간편 로그인),
`lib/session.ts`, `services/auth/login.ts`, `services/auth/flextvSignup.ts`, `app/auth/[provider]/**`.

| Ssumnation | FLEXTV | Mapping |
|---|---|---|
| `login` | `POST /v2/api/auth/signin` `{loginId, password, loginKeep, saveId, device}` | 200 → tokens + member · 401 `error: 2` → `WRONG_PASSWORD` · 401 `error: 1` → `TOO_MANY_ATTEMPTS` · empty 401 → `UNKNOWN_ID` · 423 → `SUSPENDED` · anything else → temporary error |
| `getSession` | `GET /api/my/profile` (Bearer) | 401 → signed out. One answer per token is reused for 15 s per server. |
| middleware | `POST /api/oauth/refresh` `{refreshToken}` | 5 minutes before the access token expires; a refused refresh token ends the session |
| `logout` | — | Clears Ssumnation's cookies only: FLEXTV keeps one token pair per member for all their devices. |
| 아이디 중복 확인 | `GET /api/guest/loginId/:id` | `ok` · `overlap` / `stoped` / `secession` (a 정지 or 탈퇴 member keeps the 아이디) |
| 닉네임 중복 확인 | `GET /api/guest/nickname/:nickname` | `ok` · `overlap` · `error` |
| `createFlextvAccount` | `POST /api/auth/signup` `{loginId, nickname, password, device}` | Tokens come as `Set-Cookie: flx_oauth_*` (otherwise a sign-in fetches them). 400 messages → `LOGIN_ID_TAKEN` · `NICKNAME_TAKEN` · `FORBIDDEN` · `BLOCKED` · `INVALID` |
| 간편 로그인 | `POST /v2/api/auth/signin/oauth/{kakao,naver}` · `POST /api/auth/signin/oauth/google` `{accessToken}` | `{isNew: true}` → 간편 가입 |
| `completeSocialSignup` | `POST /api/auth/signup/oauth/{provider}` `{accessToken, nickname}` | as sign-up |
| Roles | member `memberDiv` | everyone `SUPPORTER`; FLEXTV broadcasters (`memberDiv` 2 · 3) also `CREATOR`. 휴면 · 정지 · 탈퇴 (`status` ≠ 1) have no session. |

`device` is always sent (`PCWEB` / `MOBILEWEB`): without it FLEXTV treats the call as its app. The member's IP goes as
`X-Forwarded-For` — FLEXTV counts login failures, checks its black-IP list and runs its sign-up checks per IP.

## 세션

FLEXTV's opaque access token (2 days) and refresh token (30 days) stay in Ssumnation's httpOnly cookies:

- `ssumnation_session` — the access token (the cookie `lib/session.ts` already used)
- `ssumnation_refresh` — `1.{keep}.{access expiry}.{refresh token}`

"로그인 유지" makes both outlive the browser; otherwise both end with it. Server Components cannot set cookies, so the
middleware renews the access token (`lib/flextv/sessionRefresh.ts`) and hands the renewed cookie to the page of the same
request.

## 회원가입

약관 동의 → 계정 설정 → 완료, and the member is signed in right away. FLEXTV's rules (`lib/flextv/rules.ts`): 아이디
6–15 영문 · 숫자 (not digits only, no "flex"), 비밀번호 8–15 with a letter, a digit and one of ``~`!?@#$%^&*()+=``,
닉네임 2–10. There is no SMS step: FLEXTV asks for its 본인인증 where it needs it (charging, broadcasting).

## 간편 로그인

`/auth/{provider}?next=` → the provider → `/auth/{provider}/callback`. The state is an httpOnly cookie on `/auth`; the
code is exchanged on the server. A social account FLEXTV does not know goes to `/signup/social` (약관 동의 → 닉네임,
a suggestion filled in) with the provider's token in an httpOnly cookie for 10 minutes — never in the address.

Ssumnation must use **FLEXTV's own apps**: FLEXTV checks that a Kakao token came from its app and that a Google ID token
was issued to its client, and Kakao and Naver give each app its own user ids — another app would make every existing
FLEXTV member a new one. Twitch (FLEXTV also has it) is not connected in phase 1.

## FLEXTV-side changes needed before sign-ups open to the public

1. **Store the agreements.** FLEXTV's sign-up neither takes nor records the terms and the marketing choice; Ssumnation
   checks the required ones but has nowhere to keep them.
2. Add Ssumnation's callback addresses (`https://<site>/auth/{kakao,naver,google}/callback`, and the 도우미 domain's) to
   FLEXTV's Kakao, Naver and Google apps.
3. Make sure the path from Ssumnation to FLEXTV's API keeps `X-Forwarded-For` (FLEXTV trusts it: `app.proxy`).
4. The security review of FLEXTV's API and oauth server (shared separately, not in this repository).

## Known limits of phase 1

- 비밀번호 찾기 opens FLEXTV's page (it needs FLEXTV's 본인인증); the password-change prompt (`/login/password-change`)
  is not used.
- The login lock is FLEXTV's (20 wrong passwords within 10 minutes → 10 minutes refused), not the mock's 5-and-reset.
- FLEXTV answers a 휴면 · 정지 · 탈퇴 member like an unknown 아이디, so the screen says "등록되지 않은 아이디입니다".
- A 간편 로그인 session ends with the browser (no "로그인 유지" choice on that path yet).
- 마이페이지 (account linking, 본인인증, withdrawal), the wallet and the header balance are still the mock.
