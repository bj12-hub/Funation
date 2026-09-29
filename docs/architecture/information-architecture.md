# Information architecture (IA)

**Decision (2026-09-30, product owner):** the site's feature structure and logic follow funnation.co.kr. We keep our own design tokens and components; we do not copy funnation's design. The Figma screens get updated to this structure later (see `docs/figma/code-first-screens.md`).

## Public site

### Header

| | Before (Figma 710:978) | Now (funnation structure) |
|---|---|---|
| Left | ☰ · logo | ☰ (collapses the side menu; on phones and tablets it opens the drawer) · logo |
| Center | LIVE · 인기 크리에이터 · 명예의 전당 · 고객센터 | — (the links moved to the side menu) |
| Right | 마이페이지 · theme · language · profile | 검색 (→ /creators) · **충전 {FN}** (→ /wallet) · 알림 (TBD, disabled) · theme · language · profile |

Auth pages keep the Figma header.

### Side menu

It now shows on every `(main)` page (`components/layout/AppShell`). Before, only some pages had it.

- **Profile card:** avatar, nickname, 썸네이션 ID, and FN balance.
  - Creators get a **크리에이터 스튜디오** button.
  - Members without the Creator role get **내 채널 만들기** instead.
- **Charge buttons:** FN 충전 and 모바일에서 충전 (QR).

Menu groups:

| Group | Items (route) | funnation equivalent |
|---|---|---|
| (browse) | 홈 `/` · 전체 방송 `/live` · 크리에이터 찾기 `/creators` · 즐겨찾기 `/favorites` · 커뮤니티 `/community` | 홈 · 전체 방송 · 크리에이터 찾기 · 즐겨찾기 · 커뮤니티 |
| 플랫폼 후원 | SOOP 후원 · FlexTV 후원 · 플랫폼 후원 내역 `/donation/history` | none (our confirmed platforms) |
| 마이 (signed in) | 내 정보 `/mypage` · 후원 내역 `/wallet/donations` · 지갑 `/wallet` · 쪽지 `/messages` · 칭호 `/mypage/titles` · 별명 관리 `/mypage/nicknames` · 랭킹 `/mypage/ranking` | 내 정보 · 후원 내역 · 지갑 · 쪽지 · 칭호 · 별명관리 · 랭킹 |
| 더보기 | 이벤트 `/events` · 출석체크 `/attendance` · 명예의 전당 `/hall-of-fame` · 고객센터 `/support` · 설정 (TBD) | 이벤트 · 명예의 전당 · 고객센터 · 서비스 소개 · 설정 |

Changes from before:

- **Removed from the side menu:**
  - 실시간 인기 급상승: now reachable from the `/live` tabs.
  - 시청 기록: this was disabled before.
- **Not built yet:**
  - 서비스 소개 (`/about`)
  - 투네이션 내역 이관: needs a product decision.
  - 알림 (notifications)

### Home (`/`)

Sections now follow the funnation home order. Card and banner visuals keep the Figma components.

| Order | funnation | Ours |
|---|---|---|
| 1 | 요즘 인기 많은 크리에이터에게 후원하세요! + 새로고침 | `CreatorStrip`: avatar row. 새로고침 reshuffles the order for display only. A creator opens the profile popup. |
| 2 | Promotion banner | `HeroCarousel` (Figma hero slides) |
| 3 | 전체 방송: 인기 라이브 / 전체 라이브 | `HomeLiveTabs` (see below) |
| 4 | 인기 라이브 영상 모음 | `TrendingSection`, renamed; 전체보기 → `/live/popular` |
| 5 | Premium banner | `PromoBanner` |

`HomeLiveTabs` has two tabs:

- **인기 라이브:** one "{카테고리} 추천 라이브" row per recommended section, then 그 외 라이브. Each row shows 4 cards and links to 전체보기 `/live?category=`.
- **전체 라이브:** the 12 channels with the most viewers, plus a link to `/live`.

The old Figma home sections were removed from the home page:

- 지금 뜨는 영상: renamed to 인기 라이브 영상 모음.
- LIVE 시청자 수 랭킹 TOP 5
- ✨ LIVE 인기 크리에이터 grid: replaced by the strip.
- 관심사 카테고리 + 현재 라이브 방송: replaced by the category rows. The full filter is on `/live`.

### 크리에이터 찾기 (`/creators`)

The page follows funnation `/donor/stores`. From top to bottom:

- **Header:** the title "크리에이터" and the line "지금 N명이 방송 중이에요". The count comes from the server (`CreatorPage.liveCount`).
- **Controls:** a search box, and sort tabs **인기순 · 라이브 · 최신순**.
  - 인기순: by subscribers. This becomes the site follower count once follows exist (TBD).
  - 라이브: only live creators, by viewers.
  - 최신순: by `joinedAt`.
- **Cards:** two columns of wide cards. Each shows the avatar, a LIVE tag, the name, a two-line intro, 구독자, and 시청 N while live. Live cards are highlighted.
- **Paging:** 이전 / 다음 with the page position.
- **Removed:** the Figma category tabs. The `category` parameter still works on the server.

### 전체 방송 (`/live`, `/live/popular`)

The page follows funnation `/donor/videos`. From top to bottom:

- **Header:** "전체 방송" and "지금 방송 중인 라이브를 한곳에서 만나보세요", with the tabs **인기 라이브 · 전체 라이브**.
- **Filters:** 전체 plus a chip for every category (with an emoji), and our platform filter.
- **Grid:** four columns, sorted by viewers.
- **더 보기 (보이는 수/전체):** shows 12 more each time.
- **Removed:** the creator/title search and the sort dropdown. The header search covers creators.

### Creator channel (`/creators/[id]`)

The page follows the funnation channel page (`/store/{slug}`). From top to bottom:

- **Banner.**
- **Profile row:** avatar, name, platforms, intro and 구독자. The actions are **💝 후원하기**, which opens the 후원 panel on 홈 (`?tab=donation`), then 즐겨찾기 (funnation 팔로우), 공유 and 쪽지.
- **Tabs** (`?view=`):
  - **홈:** the existing Figma room (player + 후원/채팅 panel).
  - **크루:** the channel's active crew members.
  - **영상:** empty for now; VOD needs the YouTube integration (TBD).
  - **커뮤니티:** channel boards are TBD; it links to the site community.
  - **시그니처:** the signature catalog, sortable by 금액 낮은순 · 높은순 · 이름순. A card links to the 후원 panel.
  - **소개:** intro, categories, platforms, subscribers and join date.
- **Not built yet:**
  - The funnation 홈 extras: 다시보기, 쇼츠, 월간 후원 랭킹 and the community preview. They need VOD data and a public per-creator donor ranking (TBD).
  - The 라이브 button.

### 마이 (My area)

- **내 정보 (`/mypage`):** funnation 내 프로필. A 내 등급 card sits on top:
  - current grade and 최근 30일 후원
  - progress to the next grade
  - 다음 등급 미리보기 (→ `/mypage/titles`)
  - 크리에이터 스튜디오로, or 내 채널 만들기 for members without the Creator role
- **후원 내역 (`/wallet/donations`):** funnation 내 후원 내역. The Figma type tabs and period filter stay. Added, all server-side:
  - search by 크리에이터명 · 메시지
  - 최소 / 최대 FN
  - 최신순 / 오래된순
  - the "결과 N건 · 합계 N FN" summary

  The CSV export uses the same filters.
- **지갑 (`/wallet`):** unchanged. Its 전체 · 충전 · 사용 · 환불 · 적립 ledger already covers funnation's 사용 · 충전 내역 tabs. funnation's 구매 내역 (store purchases) and 환불 안내 (policy text) are TBD: we have no store, and the refund policy is undecided.

### Phones

A bottom tab bar (≤900px): 홈 · 즐겨찾기 · 커뮤니티 · 마이.

## Creator studio

### Header

The studio header follows the funnation studio: logo + **스튜디오** badge on the left; 사이트로 (home), 알림 (TBD, disabled), language and the channel menu on the right. The Figma nav (📺 크리에이터 · 고객센터) was removed.

### Sidebar

`features/creatorStudio/CreatorSideNav.tsx`:

| Group | Items (route) | funnation equivalent |
|---|---|---|
| (내 채널) | 대시보드 `/creator` | 대시보드 |
| 채널 | 채널 설정 `/creator/settings` · 후원 페이지 설정 `?tab=settings` · 칭호 관리 `?tab=titles` · 유튜브 연동 (TBD) · 영상 목록 (TBD) | 채널 설정 · 유튜브 연동 · 영상 목록 · 칭호 관리 |
| 방송 | 위젯 · 방송 도구 · 오버레이 주소 · 이미지·사운드 (TBD) · 리모컨 | 위젯 · 오버레이 주소 · 이미지·사운드 · 리모컨 |
| 크루 방송 | 크루 관리 · 방송 운영 | 엑셀방송 · 엑셀콘 |
| 수익 | 수익 현황 `/creator/revenue` · 받은 후원 `?tab=list` · 후원 순위 `?tab=ranking` · 후원 필터링 `?tab=filtering` · 크리에이터 랭킹 | 현황 · 받은 후원 |
| 정산 | 정산 현황 · 정산 인증·등록 · 정산 신청 · 정산 관리 | 정산 인증 · 정산 신청 |
| (소식) | 소식 `/creator/updates` | 소식 |

- The 후원관리+ tabs are linked one by one; the sidebar marks the active `?tab=`.

### Dashboard (`/creator`)

The top cards follow the funnation dashboard. They are laid out in two columns, and the server computes every value (`getDashboardSummary`).

| funnation card | Ours |
|---|---|
| 내 채널 · 채널 설정 › | The existing channel card: profile, 후원 링크, 계정 관리 / 정산 관리. |
| 받은 후원 · 후원 내역 › | 오늘 · 이번 주 · 이번 달 (₩ + 건수) and 누적. Links to 후원관리+ 후원 리스트. |
| 정산 · 정산 신청 › | 정산 가능 · 누적 수익 · 누적 출금, in FN from the settlement records. |
| 후원자 순위 · 랭킹 위젯 › | This month's top 5. Links to the widgets page. |
| 소식 · 전체 › | 업데이트 소식 card |

The Figma sections stay below the cards: 이벤트 / 크리애드 banners, 후원 통계 (period filter + chart), and 최근 후원 내역 + ranking tabs.

The 누적 value now sums the whole period since the channel debut. Before, the stats day helper capped it at 366 days.

### 수익 현황 (`/creator/revenue`)

This follows the funnation 수익 대시보드. The server computes every value (`getRevenueOverview`).

- **Header:** title with a **정산 요청** button.
- **Tiles:** 총 수익 (전체 기간) · 미정산 (정산 가능 FN) · 오늘 후원 (₩, 건수) · 이번 달.
- **Trends:** 일별 후원 추이 (last 30 days) and 월별 수익 추이 (last 6 months).
- **상위 후원자.**
- **바로가기:** 받은 후원, 정산 현황, 정산 요청.
- **TBD:** 수익원별 상세 (per donation type or store) needs per-type revenue data.

TBD:

- Whether 이번 주 means the calendar week or the last 7 days. The mock uses the last 7 days.
- Whether 누적 수익 counts pending requests.
- ₩ versus FN units on the dashboard. The FN exchange rate is TBD.
- The dashboard stays the funnation 수익 현황 equivalent.

## Open decisions (TBD)

- Notifications: what triggers them and how they are stored.
- A 서비스 소개 page.
- Donation-history migration from other services.
- A settings page (what it holds).
- Whether the header search should become a full search page (live + creators + community) instead of linking to 크리에이터 찾기.
