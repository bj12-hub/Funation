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
| 5 | 방송인 등록 · 방송 설정 · 대시보드 · 수익 · 받은 후원 · 정산 (환전) | **done** (below, "5단계") |
| 6 | Ssumnation-only features (룰렛 · 뽑기 · 위시리스트 · 그림 · 미니 · 퀘스트) on new FLEXTV endpoints | **front done** (below, "6단계"): the rooms' types, 퀘스트, 후원 종류 설정, 후원 내역 · 받은 후원, the 리모컨 and the OBS overlays, against the contract; FLEXTV's endpoints are next |
| 7 | The remaining screens: 마이페이지, 즐겨찾기, 알림, 크리에이터 찾기, the home, 고객센터, 채널 설정; the rest not served | **done** (below, "7단계") |
| 8 | The 위젯 page: 오버레이 테마 and the look of the overlays FLEXTV runs, kept by FLEXTV | **front done** (below, "8단계"), against contract §10 |

One switch turns on every phase built so far. Since phase 7 no page a member reaches with FLEXTV shows the mock: what
FLEXTV has no backend for is not served (below, "7단계"), so a production build no longer runs into a missing mock.

## Settings (`apps/web/.env.example`)

| Variable | Meaning |
|---|---|
| `NEXT_PUBLIC_BACKEND=flextv` | Turns the connected phases on (`lib/flextv/mode.ts`: `FLEXTV_AUTH`, `FLEXTV_WALLET`, `FLEXTV_DONATION`, `FLEXTV_LIVE`, `FLEXTV_STUDIO`, `FLEXTV_SITE`). Unset: the mock. |
| `FLEXTV_API_URL` | FLEXTV's API server (`server/` of FLEXTV's web repository), e.g. its stage. Server-side calls only — the browser never calls FLEXTV, so no CORS entry is needed. |
| `FLEXTV_SSUMNATION_API=on` | Phases 6 and 8: Ssumnation's own types on FLEXTV channels and their overlays' design, through the endpoints FLEXTV adds (`docs/development/flextv-ssumnation-api.md`). Server-only; leave it unset until FLEXTV serves them. |
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
| 영상 | `GET /api/channels/:id/stream?option=all` asked as a signed-out viewer, then FLEXTV's player `/embed/channels/:id/play` in a sandboxed iframe | FLEXTV's player handles its engines (NCP, LL-HLS …) and playback tokens. It is always signed out inside another site (its cookies are not sent there), so a 19+, password, fan-only or full stream shows "FLEXTV에서 보기" instead. Only the stream id, title, viewer count and 화면 방향 are read — never the sources or the room's settings; a landscape stream plays in a 16:9 frame, a portrait one in the room's portrait frame. A channel or live without FLEXTV's picture shows a neutral one (`lib/flextv/placeholders.ts`) |
| 채팅 읽기 | `GET /api/channels/:id/stream/recent/messages?streamId` | the browser asks every 2 s while visible; the server asks FLEXTV at most once per stream in 2 s, whoever watches; passed on: nickname, a color, the text (never the 아이디); the chat opens first while on air |
| 채팅 보내기 | `POST /api/channels/:id/stream/message` `{streamId, source:"web", message, messageType:0}` | with the member's token on the server; up to 100 characters; FLEXTV's refusals (muted, blocked, too long) in Ssumnation's words |

No browser talks to FLEXTV's API or chat server, so nothing needs registering on FLEXTV's side (CORS, its socket
origins, its player's domains); only FLEXTV's embed page is loaded from the browser.

Limits: chat is read every 2 s rather than pushed (FLEXTV's socket would need Ssumnation's origin on its allowlist, or
a relay); donation and system lines of FLEXTV's chat are not in its recent-messages list; a viewer is counted by
FLEXTV's player in the frame (a signed-out viewer).

## 5단계 · 크리에이터 스튜디오

FLEXTV's streamers (memberDiv 2 · 3) are Ssumnation's Creators. The studio shows only what runs on FLEXTV: 대시보드 ·
방송 설정 · 수익 현황 · 받은 후원 · 정산 현황 · 정산 계좌 · 정산 신청 · 정산 관리 (`lib/flextv/studioRoutes.ts`); the
middleware sends the other studio pages (위젯, 크루 방송, 채널 설정 …, still mock) to the dashboard.

Code: `lib/flextv/studio.ts` (registration, channel, keys, start · change · end), `lib/flextv/earnings.ts` (received 렉스),
`lib/flextv/settlement.ts` (환전), `services/channel/flextvStreamer.ts`, `services/creator/broadcast.ts` ·
`broadcastInput.ts`, `services/creator/flextvStudio.ts` · `flextvEarnings.ts` · `flextvSettlement.ts`, and the screens
`features/channel/FlextvStreamerScreen.tsx`, `features/creatorStudio/broadcast/`, `features/creatorStudio/donations/FlextvReceivedTab.tsx`,
`features/creatorStudio/settlement/FlextvSettlementScreens.tsx`.

| Ssumnation | FLEXTV | Notes |
|---|---|---|
| 방송 시작하기 (`/channel/new`) | `GET /api/my/profile`, `POST /api/my/chennel-register` | FLEXTV's order: 본인인증 (on FLEXTV's site) → foreign members through its 1:1 문의 → 만 14세. FLEXTV's 방송 준수사항 first. One registration at a time per member; the member is read again, so the Creator role shows on the next page |
| 방송 설정 · 서버 · 스트림 키 | `GET /api/my/channel/stream-key-sets`, `GET …/streams/latest/engine`, `POST …/update-stream-engine` | 짧은 지연 and 일반, as FLEXTV's page. The key is read from FLEXTV only when its owner presses 보기 · 복사, and kept nowhere; the engine changes only while no stream is open, always for the member's own channel |
| 방송 시작 · 변경 · 종료 | `POST /api/my/channel/start-stream`, `PUT …/streams/:id`, `POST …/stop-stream`; options from `GET /api/guest/themes`, `GET /api/my/channel/tag` | FLEXTV starts a broadcast only while OBS is sending (its "송출되고 있지 않습니다" is explained), and ends it only when asked. The fields of FLEXTV's PC form: 제목 64자, 카테고리, 태그 3개, 화면 방향, 화질, 연령제한 (19+ members only; the 성인 category needs it), 탐방허용, 워터마크, 녹화 방지 경고, 비밀번호방. The room password stays on the server (a change keeps it unless replaced); 방송 준수사항 before every start; a 정지 channel cannot start |
| 대시보드 · 수익 현황 | `GET /api/luv/receivedluv-sum`, `GET /api/luv/receivedluv-list` (`sendLexOption=ViewByCase`, whole KST days) | 오늘 · 누적 · 환전 from FLEXTV's summary; per-period figures add up its list (statuses 0 · 1 · 9, as FLEXTV counts), at most 2,000 후원 per figure — a busier period says so. Amounts are 렉스, shown as FN; no ₩ figure (FLEXTV pays at each streamer's contract rate, which it does not publish). 수익원별 상세 and the event banners are left out |
| 받은 후원 | `GET /api/luv/receivedluv-list` | FLEXTV's pages of 10, period filter, its exact 닉네임 search; the senders' 아이디 never reach the browser. FLEXTV records no message with the list |
| 정산 현황 · 정산 계좌 | `GET /api/my/banks`, `GET /api/guest/refcode/bankCode`, `GET /api/guest/timeCheck/21` | the account is masked on the server; it is registered and changed on FLEXTV's 환전 page (`/my/exchange`, its document review) |
| 정산 신청 | `POST /api/luv/withdraw` `{amount, businessType}` | FLEXTV's rules checked here too: 본인인증, 계좌, 0시 1분 ~ 14시, one open request, 500 렉스 minimum, at most 환전 가능 렉스, 사업자 정산 for 엔터 소속 on Wednesdays before 14:00. One key ⇒ one request per member for 30 minutes, one at a time per member; FLEXTV's unclear "요청이 실패하였습니다" is settled from its list (IN_PROGRESS until it shows, at most two minutes). The payout is FLEXTV's, shown after the request |
| 정산 관리 · 취소 | `GET /api/luv/withdraw-list`, `GET /api/luv/withdraw-cancel` | FLEXTV's ₩ figures (신청 금액 · 원천징수 · 실수령액); 취소 only for a 신청 of the member's own just read from their list, not on Wednesdays and Thursdays (FLEXTV's 환전 page rule) |

## 6단계 · 썸네이션 전용 후원 (front first)

2026-10-25: the screens first. A FLEXTV channel's room offers Ssumnation's types where FLEXTV can deliver them:

| Type | How | Notes |
|---|---|---|
| 영상 후원 | FLEXTV's own `POST /api/luv/send` with its YouTube effect (`sendType: "youtube"`), as its 영상후원 form sends it | Offered where the streamer turned 영상 후원 on in FLEXTV's 도우미 (`GET /api/luv/effect-settings`); priced as they set it — the played length × 렉스 per second, from their minimum, up to their longest range (checked on the server; FLEXTV's own server does not). Needs nothing new on FLEXTV. FLEXTV's own web currently hides its 영상 tab. 음성 후원 is not offered: FLEXTV's is an uploaded sound file |
| 미니 · 위시리스트 · 그림 · 룰렛 · 뽑기 | The endpoints FLEXTV adds for Ssumnation: `docs/development/flextv-ssumnation-api.md` | Behind `FLEXTV_SSUMNATION_API=on`. The streamer's settings, the donation by an Idempotency-Key FLEXTV keeps (an unclear answer is asked again by the key, and sent again only if FLEXTV never got it), the room's 내 룰렛 · 내 뽑기 |
| 퀘스트 | §2 (`QUEST`, held by FLEXTV until 성공), §6 decisions · extensions | The supporter decides 성공 · 실패 in 후원 내역, the streamer 취소 (and 성공 · 실패 with 크리에이터 성공 결정) in 받은 후원 › 퀘스트 and the 리모컨 — the mock's rules; FAILED · CANCELED give the 렉스 back. Its minimum and title length are shared with 그림 (`game`), as in Ssumnation |
| 후원 종류 설정 (studio) | `GET · PUT /api/ssumnation/my/donation-settings` (contract §5) | `/creator/donation-types`, in the studio menu only with `FLEXTV_SSUMNATION_API=on`: 미니 (on/off, 1 ~ 999 FN, its colors from Ssumnation's palette), 위시리스트, 그림 · 퀘스트 (their shared minimum, the longest 퀘스트 time, 리모컨 시간 연장), 룰렛 (items and percents adding up to 100), 뽑기 (확률형 · 재고형). Checked on the server with the mock studio's limits before FLEXTV checks it again |
| 후원 내역 · 받은 후원 | §7 lists | 후원 내역's 퀘스트 후원 · 게임 후원 tabs are FLEXTV's quests and 룰렛 · 뽑기 (state, refund, the result once revealed); 받은 후원 has a 퀘스트 list with the held 렉스 |
| 리모컨 (`/creator/remote`, `/popout/remote`) | §8 | The mock 리모컨's 퀘스트 · 룰렛 · 뽑기 panels unchanged, on FLEXTV's broadcast state (start · reveal · finish · pause · hide, claims, quest decisions and extensions), and the OBS overlay addresses. The 후원 알림 · 방송 도구 · 투표 parts are not there: the alert is FLEXTV's 도우미 |
| OBS overlays (`/overlay/widget/{roulette,gacha,gacha-board,quest,mini}/{key}`) | §9 | The key is FLEXTV's (reissued from the 리모컨); the state is FLEXTV's; the look is Ssumnation's default (FLEXTV keeps no overlay design). The 후원 알림 overlay and the other widgets are not served with FLEXTV |

Every type is checked with Donation Core's rules (`services/donations/donationDetails.ts`, shared with the mock) against
the channel's catalog as FLEXTV has it at the send; prices of 위시리스트 · 뽑기 are checked again (PRICE_CHANGED). Code:
`lib/flextv/ssumnation.ts`, `lib/flextv/ssumnationBroadcast.ts` (§6–§9), `lib/flextv/donation.ts` (`readVideoSetting`, the
video send), `services/donations/flextvDonate.ts` (`loadFlextvCatalog`, the sends), `services/donations/flextvGames.ts`
(the room's panels), `services/creator/flextvBroadcastGames.ts` — which the existing services (`quests.ts`,
`donationManagement.ts`, `questRemote.ts`, `rouletteRemote.ts`, `gachaRemote.ts`, `widgetOverlay.ts`) delegate to, so their
screens are unchanged — and `services/creator/flextvRemote.ts`.

Next: FLEXTV implements the contract and `FLEXTV_SSUMNATION_API` goes on; the overlays' design is phase 8; the 리모컨's
alert part (with FLEXTV's 도우미) and the 도우미 domain are not connected.

## 7단계 · 남은 화면

The rest of what a member reaches runs on FLEXTV (`FLEXTV_SITE`), each through its existing service, which delegates to a
`flextv*` module when the switch is on, so the screens stay Ssumnation's:

| Screen | FLEXTV | Notes |
|---|---|---|
| 마이페이지 (`/mypage`) | `GET /api/my/profile`; `PUT /api/my/profile` (multipart: `nickname`, `image`); `POST /api/oauth/password` | 사진 · 닉네임 (FLEXTV's 2–10자 rule, its 중복 확인 and forbidden words) · 비밀번호 (FLEXTV's 8–15자 rule; signed out afterwards, as in Figma 747:738, and not offered to a Kakao · Naver · Google sign-up without a password); the 아이디 stays; 가입 방법 is shown. 본인인증 and 회원 탈퇴 open FLEXTV's site (`/my/personal-auth`, `/my/expire`). Ssumnation's own sections (활동 등급, 후원자 프로필, 랭킹 노출, 연결 플랫폼, 마케팅 수신) are not shown |
| 즐겨찾기 (`/favorites`, the room's ⭐) | `GET · POST /api/subscribes`, `GET /api/subscribes/:id/check`, `DELETE /api/subscribes/:id` | FLEXTV's 즐겨찾기 by channel id (its paid 구독 is another thing). FLEXTV takes one only after its 본인인증, checked here before asking; FLEXTV's "FAIL" is settled by its check. The room shows the 즐겨찾기 count; 쪽지 · 신고 are not there |
| 알림 (bell, `/notifications`) | `GET /api/my/notification-list`; the profile's `setting.notificationView` | FLEXTV's latest ten, without times; reading them marks them read on FLEXTV, so the bell shows "N" while something is new. A channel's 알림 opens its room, FLEXTV's other pages its site |
| 크리에이터 찾기 (`/creators`) | `GET /api/channels/rankings?sort=all`, `GET /api/channels/searchRankings`, the live list | 인기순 = FLEXTV's weekly ranking, 라이브 = its live list by viewers, a search its 방송국 검색; no categories and no 최신순 (FLEXTV has neither). One ranking read a minute per server |
| 홈 | the live list and the ranking | The banner and 인기 라이브 영상 are the most watched streams, the strip the ranking. Ssumnation's promotion and arrival notices are its own content and are not shown |
| 고객센터 (`/support`) | `GET /api/cs/notice-list`, `GET /api/cs/notice-page`, `GET /v2/api/cs/inquiry-list?boardType=2`, `GET /api/cs/inquiry-list` | FLEXTV's 공지사항 (published ones only) and 자주 묻는 질문, their editor HTML shown as plain paragraphs; the member's 1:1 문의 with FLEXTV's answers — written on FLEXTV's site (`/cs/inquiry`), like refunds. No categories or view counts |
| 채널 설정 (`/creator/settings`) | `GET · PUT /api/my/channel/profile` (multipart), `GET /api/my/channel/:name`, `GET · POST /api/my/channel/external-link` | The FLEXTV 방송국: 이름 (2–15자, 중복 확인 again right before saving), 소개 (1–250자; FLEXTV cannot empty it), 배너 (JPG · PNG under 20MB, the bytes checked), the five platform links (FLEXTV's free links sent back unchanged). One change per call, as FLEXTV's form. The channel's picture is the streamer's profile picture (마이페이지) |

**Not served with FLEXTV** (`lib/flextv/siteRoutes.ts`; the menus leave them out): 커뮤니티, 이벤트, 출석 체크, 명예의 전당,
SOOP · FlexTV 플랫폼 후원, 마블 · 럼블 invitations, 쪽지, the supporter identity pages (칭호 · 후원 닉네임 · 내 랭킹 · 차단),
회원 탈퇴 and password reset (FLEXTV's site) — sent home; the mock studio's OBS overlays, pop-outs and API routes — a 404
(the FLEXTV 위젯 overlays and the 리모컨 pop-out stay); a mock creator's room — a 404; the 도우미 domain's own pages — a 404.
Which of Ssumnation's own areas come back on which backend is TBD. Code: `lib/flextv/member.ts`, `channels.ts`,
`notifications.ts`, `support.ts`, `channelSettings.ts`, `siteRoutes.ts` and the `services/**/flextv*.ts` they serve.

## 8단계 · 위젯 · 오버레이 디자인 (front first)

With `FLEXTV_SSUMNATION_API=on` the studio's 위젯 page (`/creator/widgets`, in the menu next to 후원 종류 설정) sets how the
overlays of phase 6 look; FLEXTV keeps it as one document per streamer (contract §10):

| Part | Where | Notes |
|---|---|---|
| 오버레이 테마 | the page's 테마 gallery (`saveOverlayAppearance`) | 볼드 플랫 · 미니멀 필 · 소프트 글래스 and the 포인트 색상, for every overlay that follows it |
| 퀘스트 · 미니 · 룰렛 · 뽑기 | their popups (`getWidgetDetail` · `saveWidgetSettings`), with FLEXTV's overlay address | **The look only**: each one's theme; 퀘스트's style, fonts and how many show; 미니's band or bubble, direction, speed, fonts and the smallest amount shown; each 뽑기's machine style and point color (by its §5 id), the 크레딧 and the 당첨 리스트's title and speed. The rules — items, odds, prices, minimums, 시간 연장 — are 후원 종류 설정's, linked from each popup; 자동 시작 · 결과 공개 are the 리모컨's |
| OBS overlays | `/overlay/widget/{roulette,gacha,gacha-board,quest,mini}/{key}` | Drawn with the document read by their key (once a second per key per server); a 뽑기 in its own look by the `gachaId` FLEXTV adds to the stage (§8). FLEXTV unreachable: the default look |

Ssumnation checks every part before it is sent and reads the document leniently (a part it cannot read is its default);
the other widgets of the mock studio (후원 알림, 채팅, 목표, 자막 …) have no FLEXTV overlay and are not on the page. Code:
`services/creator/flextvOverlayDesign.ts` (the document), `flextvOverlaySettings.ts` (which `overlayTheme.ts` and
`widgetSettings.ts` delegate to), `lib/flextv/overlayDesign.ts`.

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
6. The security review of FLEXTV's API and oauth server (shared separately, not in this repository) — it now also
   covers the broadcast and 환전 endpoints the studio uses.
7. **Totals for the studio.** FLEXTV has no 받은 렉스 totals per period, so the dashboard adds up its list (capped);
   an endpoint returning count · sum · donors per day for a period would make every figure exact and cheap.
8. **The 환전 계좌 from Ssumnation.** Registering or changing the account (with its documents) happens on FLEXTV's site.
9. **The Ssumnation endpoints** of `docs/development/flextv-ssumnation-api.md` (phase 6), then `FLEXTV_SSUMNATION_API=on`.
10. **알림 with an id and a time** (phase 7): FLEXTV's list has neither, and one "new" flag for all, so Ssumnation cannot
    mark one 알림 read or say when it came.
11. **Linking and unlinking social logins** for an existing member (FLEXTV only signs up or in with them), if 마이페이지
    is to offer it as Ssumnation's design does.

## Known limits

- 비밀번호 찾기 opens FLEXTV's page (it needs FLEXTV's 본인인증); the password-change prompt (`/login/password-change`)
  is not used.
- The login lock is FLEXTV's (20 wrong passwords within 10 minutes → 10 minutes refused), not the mock's 5-and-reset.
- FLEXTV answers a 휴면 · 정지 · 탈퇴 member like an unknown 아이디, so the screen says "등록되지 않은 아이디입니다".
  The 탈퇴 철회 card (회원탈퇴 유예, 2026-11-01) is the mock's: what FLEXTV answers during a 탈퇴 신청's 30 days is
  checked on staging.
- A 간편 로그인 session ends with the browser (no "로그인 유지" choice on that path yet).
- Payletter returns to a FLEXTV page that closes the window; a payment abandoned in the window stays "not completed"
  (FLEXTV records no failure for it).
- Not connected: 내통장결제 (Hecto's SDK), 해외카드 (NICE), 현금영수증, refunds, pending 무통장 requests in 충전 내역.
- Every list of channels (live, 크리에이터 찾기, the home, 즐겨찾기) is FLEXTV's; the mock's creators are not shown.
- 19+, password and fan-only streams are watched on FLEXTV (FLEXTV's player in another site is signed out).
- 마이페이지: 본인인증, 회원 탈퇴 and the phone number change on FLEXTV's site; social logins cannot be linked later.
- Studio: only the pages above run on FLEXTV. Of 위젯 · 오버레이 only the 테마 and the looks of 퀘스트 · 미니 · 룰렛 · 뽑기
  (phase 8); 크루 방송, 채팅봇, 유튜브 연동, 소식, the other widgets and tools, and the 도우미 domain are not connected;
  구독 정산 (FLEXTV's channel subscriptions) is not shown.
- The admin console (`apps/admin`) still works on the mock; FLEXTV's members, payments and settlement are run in
  FLEXTV's own admin.
- Studio figures are FLEXTV's 렉스 (FN); a period's figures add up at most 2,000 후원, and dates are FLEXTV's (KST).
- 방송 설정 covers FLEXTV's PC broadcast form; 팬방송, 동시 송출 (YouTube), 엑셀 방송 and the mobile caster stay on FLEXTV.
