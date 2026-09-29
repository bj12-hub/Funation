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
| 방송 운영 "후원 리스트" (`crew/BroadcastFeed.tsx`) + 시작 폼 "프로젝트" | crew broadcast v3 PR | 멤버 키워드, 반영 방식 (자동 / 확인 후), 시뮬 후원, 한방 (시작 · STOP 몰아주기 · 취소), 필터 (전체 · 미지정·대기 · 반영 · 취소 건), 멤버 배정 select; 프로젝트 · 회차 chip on live title and history |
| `/overlay/crew/[key]` OBS scoreboard (`crew/CrewScoreOverlay.tsx`) | crew broadcast PR | Transparent browser source, top 10 + team gauge |

| `/creator/settlement` 정산 준비 체크리스트 (`settlement/SettlementChecklist.tsx`) | settlement checklist PR | 4 steps (본인인증 · 정산 자료 등록 · 서류 심사 · 정산 계좌) with links; sits between the 429:4 banner and cards |

| `/wallet/charges` 상세정보 popup "환불 요청" + list tag (`features/wallet/ChargeTable.tsx`) | refund request PR | Request form (사유), 접수·심사 중 state inside Figma 643:4; policy copy is TBD |

| `/messages` 쪽지 (`features/messages/MessagesScreen.tsx`) + side nav "쪽지" + room "✉️ 쪽지" action | messages PR | 4 mailboxes with counts, search, bulk 보관/스팸신고/삭제, expand-to-read, 답장, compose modal (`?to=`) |

| `/community` · `/community/new` · `/community/[id]` · `/community/[id]/edit` (`features/community/*`) + side nav "커뮤니티" | community PR | Board list (분류 tabs, search, pages), editor (분류 chips), post detail with author actions and comments |

| `/events` · `/events/[id]` (`features/events/*`); home + room promo "지금 참여하기" → `/events` | events PR | Filter tabs, event cards (phase / 참여함), detail with 참여하기 and reward TBD note |

| `/mypage/ranking` 내 후원 랭킹 (`features/supporter/MyRankingScreen.tsx`) + 마이페이지 card | my ranking PR | Period segment, 내 순위 / 상위 % / 합계, 크리에이터별 순위, 글로벌 TOP 20 (mock field) |

| `/creator/widgets/tools` 방송 도구 (`features/creatorStudio/widgets/BroadcastToolsScreen.tsx`) + 위젯 페이지 "방송 도구" group | broadcast tools PR | Remote cards: 자막 (크기, 띄우기/내리기), 전광판 (줄·속도), 타이머 (카운트다운/스톱워치, 시작·일시정지·초기화), 엔딩 크레딧 (제목, 감사 문구, 크루 순위) + 오버레이 URL 복사 |
| `/creator/remote` 리모컨 (`features/creatorStudio/remote/RemoteScreen.tsx`) + sidebar "🎛️ 리모컨" | alert remote PR | 오버레이 URL, 전체 제어 (일시정지 · 음소거 · 건너뛰기 · 전체 취소), 테스트 후원 (금액 프리셋, display only), 알림 설정 (알림음 · TTS 볼륨, 최소 금액, 표시 시간), 대기열 · 최근 알림 + 다시 보내기 |
| `/creator/widgets/overlays` 오버레이 주소 (`widgets/OverlayUrlsScreen.tsx`) + 위젯 페이지 "🔗 오버레이 주소" card | overlay urls PR | Groups, recommended OBS size, masked key, 설정 / 미리보기 / 복사, 목록 전체 복사 |
| `/overlay/alert/[key]` OBS 후원 알림 (`remote/AlertOverlay.tsx`) | alert remote PR | Transparent source (800 × 600), pop-in card, browser TTS; per-type styles and sounds TBD |
| `/overlay/tool/[tool]/[key]` OBS overlays (`widgets/ToolOverlay.tsx`) | broadcast tools PR | Transparent sources for subtitle · marquee · timer · credits; styles/fonts TBD; 이모지·레이어 효과 still planned |

| 후원관리+ 후원 리스트 "CSV 다운로드" (`donations/CsvExportButton.tsx`) | donations csv PR | Button beside 검색; exports the current filters (all pages, max 5,000 rows), UTF-8 BOM, result note |

| `/creator/updates` 업데이트 소식 (`features/creatorStudio/updates/*`) + 대시보드 "업데이트 소식" card + sidebar "📰 업데이트 소식" | creator updates PR | Posts (NEW mark, 신규 · 개선 · 버그 수정 counts, date), expandable item lists with links; read state on the server |

| 라이트 테마 (`styles/tokens.css` [data-theme="light"]) + 헤더 ☀️/🌙 토글 (`components/layout/ThemeToggle`) | light theme PR | Main site only; creator studio, OBS overlays and the home notice popups stay dark. Light values for every surface/text/border/form token need a Figma pass |

| 리모컨 "방송 도구" card (`remote/ToolsRemote.tsx`) + 전체 제어 "TTS 스킵" · "오버레이 새로고침"; 방송 도구 타이머 퀵 조정 · 크레딧 시작/중지 | remote controls PR | Timer ±30/60초, 시작/재개/일시정지/초기화; 엔딩 크레딧 시작 · 처음부터 · 중지 (overlay shows credits only while rolling) |

| 방송 운영 "서브 점수판" (`crew/SubBoards.tsx`) + `/overlay/crew/[key]?board=번호` | crew sub boards PR | 새 판 (이름, 최대 5판), 진행 중 / 마감, 구간 TOP 3, OBS 주소 복사; overlay shows the board with a 마감 mark |

| 헤더 언어 메뉴 한국어 ↔ ENGLISH (`LanguageMenu`, `lib/i18n/*`) | i18n foundation PR | Shell (header, profile menus, side menu, footer) in English; 中文 · 日本語 · ภาษาไทย shown as 준비 중. See docs/development/i18n.md |

| `/creator/revenue` 수익 현황 (`creatorStudio/revenue/RevenueScreen.tsx`) + studio sidebar "📊 수익 현황" | studio revenue PR | funnation 수익 대시보드 structure: 4 tiles + 정산 요청, 30-day daily and 6-month monthly charts, 상위 후원자, 바로가기 |

| `/creator/widgets/effects` 이펙트 · 효과 (`widgets/EffectsScreen.tsx`) + `/overlay/effects/[key]` | effects PR | 이모지 리액션 (사용 · 최소 FN · 이모지 1~6개 · 개수) and 레이어 효과 (금액 구간별 꽃가루 / 하트 비 / 별빛 / 불꽃놀이); overlay plays with each donation alert |

Add a row whenever a new code-first screen ships (see `docs/research/funnation-reference.md` for the planned features).
