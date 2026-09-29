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
| 수익 | 받은 후원 `?tab=list` · 후원 순위 `?tab=ranking` · 후원 필터링 `?tab=filtering` · 크리에이터 랭킹 | 현황 · 받은 후원 |
| 정산 | 정산 현황 · 정산 인증·등록 · 정산 신청 · 정산 관리 | 정산 인증 · 정산 신청 |
| (소식) | 소식 `/creator/updates` | 소식 |

- The 후원관리+ tabs are linked one by one; the sidebar marks the active `?tab=`.
- The dashboard stays the funnation 수익 현황 equivalent.

## Open decisions (TBD)

- Notifications: what triggers them and how they are stored.
- A 서비스 소개 page.
- Donation-history migration from other services.
- A settings page (what it holds).
- Whether the header search should become a full search page (live + creators + community) instead of linking to 크리에이터 찾기.
