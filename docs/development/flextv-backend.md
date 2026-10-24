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
| 1 | 로그인 · 회원가입 · 세션 · 간편 로그인 | **done** (below) |
| 2 | 렉스 잔액 · 충전 · 충전 내역 · 지갑 개요 | **done** (below, "2단계") |
| 3 | 후원 to a FLEXTV channel's room (일반 · 시그니처) · 후원 내역 | **done** (below, "3단계") |
| 4 | 라이브 목록 · 채널 방의 영상 · 채팅 | **done** (below, "4단계") |
| 5 | 크리에이터 스튜디오 · 방송 설정 · 수익 · 정산 | not started |
| 6 | Ssumnation-only features (룰렛 · 뽑기 · 위시리스트 · 그림 · 미니 후원 · 크루 게임 …) on new FLEXTV endpoints | not started |

One switch turns on every phase built so far. Until its phase, an area keeps its mock: in `next dev` the site mixes a
real FLEXTV member with sample data (마이페이지, 후원 내역, the creator room …); a production build is for a staging
environment until every area a member reaches is connected.

## Settings (`apps/web/.env.example`)

| Variable | Meaning |
|---|---|
| `NEXT_PUBLIC_BACKEND=flextv` | Turns the connected phases on (`lib/flextv/mode.ts`: `FLEXTV_AUTH`, `FLEXTV_WALLET`, `FLEXTV_DONATION`, `FLEXTV_LIVE`). Unset: the mock. |
| `FLEXTV_API_URL` | FLEXTV's API server (`server/` of FLEXTV's web repository), e.g. its stage. Server-side calls only — the browser never calls FLEXTV, so no CORS entry is needed. |
| `FLEXTV_SITE_CODE` | Optional `x-site-code`. Unset = FLEXTV's own members (the decision above); a tenant code would scope sign-ups to that tenant. |
| `NEXT_PUBLIC_FLEXTV_WEB_URL` | FLEXTV's site: its embeddable player, and the flows not connected yet (비밀번호 찾기, 본인인증, 환불 1:1 문의, gated streams). Default `https://www.flextv.co.kr`. |
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

## 2단계 · 렉스 충전 · 지갑

Code: `lib/flextv/wallet.ts` (FLEXTV's wallet API, mapping), `services/wallet/flextvCharge.ts` (behind the actions of
`charge.ts`), `services/wallet/flextvHistory.ts` (behind `walletHistory.ts`), `services/wallet/balance.ts` (header),
`features/walletCharge/FlextvChargeViews.tsx`.

The money is FLEXTV's: its 렉스, 110원 a 렉스 with VAT, its presets (100 · 300 · 500 · 1,000 · 2,000 · 3,000 · 4,000 ·
5,000, custom from 10), its payment providers and its rules. The screens still say "FN" — the on-screen name is TBD.

| Ssumnation | FLEXTV | Notes |
|---|---|---|
| balance (header, modal, 지갑) | `GET /api/luv/remain` | FLEXTV shows one spendable amount; no expiry, nothing held |
| who may charge | `GET /api/my/profile` | `PI` (본인인증), `isChild` (under 19), `isCustomForeigner`, `isVip` — the modal explains instead of showing the form |
| methods | `GET /v2/api/guest/payment-failure` | 카카오페이 and 무통장입금; 카드 · 휴대폰 for FLEXTV's VIP members only (others go through Hecto, not connected); a method FLEXTV switched off is left out |
| 카카오페이 · 카드 · 휴대폰 | `POST /api/shoppings/buy` `{productCode:100, productName:"렉스", amount, price:110, payMethod, methodParams:{trdDt, trdTm}, targetId:null, payDiv:1, ver, os}` | → Payletter's window. The browser opens it within the click; the modal reads `GET /api/shoppings/checkouts/:id/status` every 2 s until FLEXTV completed it (Payletter tells FLEXTV), and twice more after the window closes |
| 무통장입금 | `POST /api/shoppings/coin` `{amount, price: total, payMethod:"virtualaccount", methodParams:{name}}` | the account from `GET /api/guest/channeling-switching`, the bonus from `GET /api/shoppings/bankbook-point`; FLEXTV credits once it matches the deposit |
| 충전 내역 | `GET /api/shoppings/flex/payments?option=all` | paid charges; read back 50 at a time to the period's start (at most 1,000 rows), then filtered and paged here |
| FN Wallet | the charges + `GET /api/luv/sentluv-list` | 충전 and 사용 (후원) rows; FLEXTV shows no 환불 · 반환 · 적립 rows yet |

Every call carries the member's Bearer token, IP (`X-Forwarded-For`) and browser (`User-Agent` — FLEXTV's payment code
fails without one). FLEXTV has no idempotency key for a checkout: this server keeps one per member and key for 30
minutes, so a double click opens one checkout (a second server would not know it).

## 3단계 · 후원

Code: `lib/flextv/donation.ts` (FLEXTV's channel and donation API, mapping), `services/donations/flextvDonate.ts`
(behind `requestDonation` of `donate.ts`), `services/creators/flextvChannel.ts` (the room), the FLEXTV branch of
`app/(main)/creators/[id]/page.tsx`, `getDonationHistory` in `walletHistory.ts`.

A FLEXTV channel's room is `/creators/{FLEXTV channel id}` (a number; Ssumnation's own creators keep their ids). It shows
the channel's owner, whether it is on air, and FLEXTV's donation options only: Ssumnation's 크루, 투표, 커뮤니티, 랭킹,
즐겨찾기, 구독자 수, 별명, 멤버 지정, 익명 and 후원 알림 미리보기 are left out (FLEXTV has none of them), and so is the
chat until phase 4.

| Ssumnation | FLEXTV | Notes |
|---|---|---|
| room | `GET /api/channels/:id/profile` · `/active-stream` | owner nickname and image, description, on air and the stream's title |
| 일반 후원 | `POST /api/luv/send` `{channelId, amount, count:1, sendType:"default", effect:{type:"tts", params:{actorId:"", message}}}` | any whole 렉스 from 1; the message is read out (FLEXTV's default voice — its server ignores the voice) and also posted to chat (`POST /api/channels/:id/stream/message`) when on air, as FLEXTV's form does |
| 시그니처 | the same with `code` | the channel's approved signatures (`GET /api/channels/:id/gift-types` → `img.host`) at their fixed amounts; a changed amount is PRICE_CHANGED before sending |
| who may receive | profile `owner.PI` | an owner without FLEXTV's 본인인증 cannot receive: refused before sending |
| refusals | 400 messages | 본인인증 · under 17 · blocked by the channel · balance · FLEXTV's re-verification, each in Ssumnation's words; nothing was debited |
| 후원 내역 | `GET /api/luv/sentluv-list` | the recipient's nickname (no channel, message or kind in FLEXTV's list): rows have no link, type "후원", 처리중 until FLEXTV settles them |

FLEXTV's send has no idempotency key and can debit even when it answers with an error. Ssumnation therefore sends one
donation at a time per member, once per key (30 minutes on this server), and settles an unclear answer from FLEXTV's own
record — the member's newest sent donation before and after: a new row of the amount is the donation; none after two
minutes, not sent. Until then the result is IN_PROGRESS and the form's retry (the same key) asks again instead of
sending again.

Not connected: 미션 (도전렉스 — FLEXTV's missions are the streamer's, unlike Ssumnation's 퀘스트), 영상 · 사운드 후원
(FLEXTV's own web has them switched off), and 룰렛 · 뽑기 · 위시리스트 · 그림 · 미니 후원 (phase 6).

## 4단계 · 라이브

Code: `lib/flextv/live.ts` (FLEXTV's live API, mapping), `services/live/liveChannels.ts` (`getAllLiveChannels`: `/live`,
인기 라이브, 홈 라이브 탭), `services/creators/flextvChannel.ts` (the room's stream), `services/live/flextvRoomChat.ts`
(the room's chat actions), `features/creatorRoom/FlextvChat.tsx`, the embed branch of `features/creatorRoom/Player.tsx`.

| Ssumnation | FLEXTV | Notes |
|---|---|---|
| 라이브 목록 | `GET /api/channels/live-list-main?liveOption=total` | public (no 19+ streams for anyone, for now); blinded or suspended streams left out; sorted by viewers as before; one read per server every 15 s; a card opens `/creators/{channel id}` |
| 영상 | `GET /api/channels/:id/stream?option=all` asked as a signed-out viewer, then FLEXTV's player `/embed/channels/:id/play` in a sandboxed iframe | FLEXTV's player handles its engines (NCP, LL-HLS …) and playback tokens. It is always signed out inside another site (its cookies are not sent there), so a 19+, password, fan-only or full stream shows "FLEXTV에서 보기" instead. Only the stream id, title and viewer count are read — never the sources or the room's settings |
| 채팅 읽기 | `GET /api/channels/:id/stream/recent/messages?streamId` | the browser asks every 2 s while visible; the server asks FLEXTV at most once per stream in 2 s, whoever watches; passed on: nickname, a color, the text (never the 아이디); the chat opens first while on air |
| 채팅 보내기 | `POST /api/channels/:id/stream/message` `{streamId, source:"web", message, messageType:0}` | with the member's token on the server; up to 100 characters; FLEXTV's refusals (muted, blocked, too long) in Ssumnation's words |

No browser talks to FLEXTV's API or chat server, so nothing needs registering on FLEXTV's side (CORS, its socket
origins, its player's domains); only FLEXTV's embed page is loaded from the browser.

Limits: chat is read every 2 s rather than pushed (FLEXTV's socket would need Ssumnation's origin on its allowlist, or
a relay); donation and system lines of FLEXTV's chat are not in its recent-messages list; a viewer is counted by
FLEXTV's player in the frame (a signed-out viewer).

## FLEXTV-side changes needed before opening to the public

1. **본인인증 from Ssumnation.** FLEXTV charges only members who did its NICE 본인인증, and NICE returns to a fixed
   FLEXTV address (`server/services/personal-auth` `returnUrl`) that confirms with the browser's FLEXTV cookie. A member
   who signed up on Ssumnation can therefore not charge until FLEXTV takes a return address on Ssumnation's domain (whose
   callback would confirm with the member's Bearer token). Until then the modal sends them to FLEXTV's site.
2. **Store the agreements** — the sign-up terms and the marketing choice, and the charge terms (kept in a cookie per
   browser until then).
3. Add Ssumnation's callback addresses (`https://<site>/auth/{kakao,naver,google}/callback`, and the 도우미 domain's) to
   FLEXTV's Kakao, Naver and Google apps.
4. Make sure the path from Ssumnation to FLEXTV's API keeps `X-Forwarded-For` (FLEXTV trusts it: `app.proxy`).
5. Refunds: FLEXTV has no refund API (it takes them through its 1:1 문의), so 충전 내역 links there.
6. The security review of FLEXTV's API and oauth server (shared separately, not in this repository).

## Known limits

- 비밀번호 찾기 opens FLEXTV's page (it needs FLEXTV's 본인인증); the password-change prompt (`/login/password-change`)
  is not used.
- The login lock is FLEXTV's (20 wrong passwords within 10 minutes → 10 minutes refused), not the mock's 5-and-reset.
- FLEXTV answers a 휴면 · 정지 · 탈퇴 member like an unknown 아이디, so the screen says "등록되지 않은 아이디입니다".
- A 간편 로그인 session ends with the browser (no "로그인 유지" choice on that path yet).
- Payletter returns to a FLEXTV page that closes the window; a payment abandoned in the window stays "not completed"
  (FLEXTV records no failure for it).
- Not connected: 내통장결제 (Hecto's SDK), 해외카드 (NICE), 현금영수증, refunds, pending 무통장 requests in 충전 내역.
- `/live`, 인기 라이브 and the home's live tabs list FLEXTV's streams; the creator list, the home's other sections
  (hero, trending, creator strip) and favorites still show the mock's creators.
- 19+, password and fan-only streams are watched on FLEXTV (FLEXTV's player in another site is signed out).
- 마이페이지 (account linking, 본인인증, withdrawal) is still the mock.
