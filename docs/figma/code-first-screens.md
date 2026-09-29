# Code-first screens (Figma update checklist)

Since 2026-09-29 features without a Figma frame are built in code first and designed afterwards. Each screen below uses the existing tokens and components; the later Figma pass should create frames for them and then note the frame ids in `route-map.md`.

| Route / component | Built in | Notes for the Figma pass |
|---|---|---|
| `/creator` — 크리에이터 권한이 필요합니다 (`app/creator/layout.tsx`) | PR #44 · channel PR | No-permission state with "내 채널 만들기" CTA |
| `/channel/new` 내 채널 만들기 (`features/channel/CreateChannelScreen.tsx`) | channel PR | Slug (live availability), 이름, 소개, 크리에이터 이용약관 동의, benefits list; grants the Creator role (approval TBD) |
| `/donation/history` layout (`features/platformDonation/DonationHistoryScreen.tsx`) | PR #42 | Figma 817:8038 / 817:8223 exist but their auto-layout is broken; the built table + detail panel should replace them |
| `/wallet` FN Wallet summary + ledger (`features/wallet/WalletOverviewScreen.tsx`) | PR #43 · this PR | 817:7552 exists; the 적립 (REWARD) type is new |
| 정산 이용동의 inside the studio layout (`SettlementTermsScreen.tsx`) | PR #38 | Figma frames are standalone without chrome |

| `/mypage/titles` 칭호·등급 (`features/supporter/TitlesScreen.tsx`) | supporter identity PR | Alert preview (dark/light), 표시 설정, 등급 ladder, 글로벌 칭호, 크리에이터 칭호 progress — names/thresholds are placeholders |
| `/mypage/nicknames` 별명 관리 (`features/supporter/NicknamesScreen.tsx`) | supporter identity PR | Stats, add / rename / 대표로 / 삭제 (max 5, TBD) |
| 마이페이지 "후원자 프로필" card · 후원 패널 "별명" select (`MyPageScreen.tsx`, `creatorRoom/DonationForm.tsx`) | supporter identity PR | Entry points; the select shows only with 2+ nicknames |

| `/creator/crew` 크루 관리 (`features/creatorStudio/crew/CrewScreen.tsx`) + sidebar "👥 크루 관리" | crew members PR | Member list (add / 휴식·활동 / rename / delete), 이번 달 멤버별 순위 bars |
| 후원 패널 "멤버 지정 (선택)" chips (`creatorRoom/DonationForm.tsx`) | crew members PR | Shown only when the creator has active crew members (mock: c4) |

| `/creator/crew/broadcast` 방송 운영 (`crew/BroadcastScreen.tsx`) + 멤버/방송 운영 tabs | crew broadcast PR | Start form (팀 배틀 배정), live scoreboard with 보정 buttons, team gauge, 보정 로그, OBS 주소, 방송 이력 |
| `/overlay/crew/[key]` OBS scoreboard (`crew/CrewScoreOverlay.tsx`) | crew broadcast PR | Transparent browser source, top 10 + team gauge |

| `/creator/settlement` 정산 준비 체크리스트 (`settlement/SettlementChecklist.tsx`) | settlement checklist PR | 4 steps (본인인증 · 정산 자료 등록 · 서류 심사 · 정산 계좌) with links; sits between the 429:4 banner and cards |

| `/wallet/charges` 상세정보 popup "환불 요청" + list tag (`features/wallet/ChargeTable.tsx`) | refund request PR | Request form (사유), 접수·심사 중 state inside Figma 643:4; policy copy is TBD |

| `/messages` 쪽지 (`features/messages/MessagesScreen.tsx`) + side nav "쪽지" + room "✉️ 쪽지" action | messages PR | 4 mailboxes with counts, search, bulk 보관/스팸신고/삭제, expand-to-read, 답장, compose modal (`?to=`) |

| `/community` · `/community/new` · `/community/[id]` · `/community/[id]/edit` (`features/community/*`) + side nav "커뮤니티" | community PR | Board list (분류 tabs, search, pages), editor (분류 chips), post detail with author actions and comments |

| `/events` · `/events/[id]` (`features/events/*`); home + room promo "지금 참여하기" → `/events` | events PR | Filter tabs, event cards (phase / 참여함), detail with 참여하기 and reward TBD note |

Add a row whenever a new code-first screen ships (see `docs/research/funnation-reference.md` for the planned features).
