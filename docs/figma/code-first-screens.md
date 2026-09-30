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
| `/creator/widgets/signatures` 시그니처 후원 (`widgets/SignaturesScreen.tsx`) | signature PR | 시그니처 추가 · 수정 · 삭제 · 숨기기 · 순서 (이름, 가격 = 채널 설정, 프리셋 이미지, 매칭 규칙 "선택 시에만" / "선택 + 금액 일치"); the room panel and the Donation Core read the managed list. TBD: per-channel catalogs, image upload (이미지·사운드 library) |
| `/creator/widgets/video` 영상 후원 (`widgets/media/VideoScreen.tsx`) + `/overlay/video/[key]` | video-drawing PR | 서버 대기열 (재생 중 · 대기 · 지난 요청), 지금 재생 / 건너뛰기 / 다시 대기열로, 자동 재생 · 최대 재생 시간 · 볼륨 (채널 설정), 테스트 영상; 오버레이는 youtube-nocookie embed. TBD: 볼륨 적용 (IFrame API), 영상 심사/거절 정책, 환불 |
| `/creator/widgets/drawing` 그림후원 (`widgets/media/DrawingScreen.tsx`) + `/overlay/drawing/[key]` | video-drawing PR | 새 그림 자동 전시 (전시 시간 = 채널 설정), 다시 전시 · 내리기 · 삭제, 테스트 그림; 최근 30개 보관. TBD: 보관 기간, 신고/검수 |
| `/creator/widgets/assets` 이미지·사운드 (`widgets/library/AssetsScreen.tsx`) + `/api/media/[id]` | asset-banner PR | 이미지 (PNG · JPG · GIF · WEBP, 5MB) / 사운드 (MP3 · WAV · OGG, 2MB) 올리기 · 미리보기 · 이름 변경 · 삭제; 파일 내용으로 형식 검사 (SVG 불가), mock CDN은 추측 불가 id + nosniff. TBD: 업로드 정책 · 용량 · 검수, 커스텀 사운드 "라이브러리" 연결 |
| `/creator/widgets/banner` 배너 (`widgets/library/BannerScreen.tsx`) + `/overlay/banner/[key]` | asset-banner PR | 라이브러리 이미지 최대 10장 슬라이드, 위치 상단 · 중앙 · 하단, 넘김 간격 3~60초; 지운 이미지는 건너뜀. 시그니처 이미지도 라이브러리에서 고를 수 있음 |
| `/creators/[id]` 홈 보강 · `?view=community` (`creatorRoom/ChannelHome.tsx`) | channel-home PR | 홈 아래 월간 후원 랭킹 (서버 집계, 이번 달 내 후원 포함 · '나' 표시) + 채널 커뮤니티 최근 글 3개; 커뮤니티 탭은 채널 전용 피드 (로그인 후 글쓰기 500자, 작성자 삭제, 더 보기). TBD: 랭킹 집계 기준 · 비공개 후원자, 신고 · 숨김 · 채널 운영자 관리 |
| `/creator/youtube` 유튜브 연동 · `/creator/videos` 영상 목록 (`creatorStudio/youtube/YouTubeScreens.tsx`) + 채널 `?view=videos` | youtube PR | PlatformAdapter (`services/platforms/adapters.ts`, YouTube mock · FlexTV/SOOP는 VIDEO_LIST 미지원 선언)로 외부 DTO → 핵심 타입 매핑, 타임아웃 · 실패 코드, 영상 id 기준 중복 없는 동기화 (표시 · 고정 설정 유지), 동기화 실패 시 이전 목록 유지; 채널 영상 탭은 지원 플랫폼 영상 목록. TBD: Google OAuth · 권한 범위 · 토큰 폐기, 자동 동기화 주기, 재시도 정책 |
| `/creator/widgets/link` 후원 연동 (`widgets/DonationLinkScreen.tsx`) | donation-link PR | 플랫폼별 후원 이벤트 (adapter DONATION_EVENTS: YouTube 슈퍼챗 mock, FlexTV · SOOP 확인 중) → 후원 알림 EXTERNAL (플랫폼 통화 그대로, FN 환산 없음, FN 최소 금액 필터 미적용), 이벤트 id 기준 중복 무시, 켤 때 이전 이벤트는 재생하지 않음, 개발용 테스트 슈퍼챗 (재전달 옵션). 연동 후원은 FN · 지갑 · 수익 · 정산 기록 없음. TBD: 웹훅/폴링 주기, 통화별 최소 금액, 수익 리포트 포함 여부 |
| 헤더 알림 (`GlobalHeader/NotificationBell.tsx`) + `/notifications` (`features/notifications/NotificationsScreen.tsx`) | notifications PR | 사이트 · 스튜디오 헤더 벨: 안 읽음 배지 (30초 폴링, 탭이 보일 때만), 팝오버 최근 8개 · 모두 읽음 · 전체 보기; 전체 페이지 전체 / 안 읽음 · 더 보기. 알림 출처: 후원 완료 (요청 재시도 시 1회), 내 채널 후원 받음, FN 충전 완료, 공지 · 안내 시드. 최근 100개 보관. TBD: 알림 종류 설정, 푸시 · 이메일, 보관 기간, 사용자별 수신함 |

Add a row whenever a new code-first screen ships (see `docs/research/funnation-reference.md` for the planned features).

| `/admin` 관리자 콘솔 (`features/admin/*`, `app/admin/(console)`) + `/admin/login` + `/admin/audit` | admin shell PR | 관리자 전용 헤더 · 사이드바 (회원 · 거래 · 운영 그룹, 미구현 항목은 준비 중), 운영 대시보드 (크리에이터 · 이번 달 충전 · 후원 · 처리 대기), 감사 로그 (수정 불가 기록), 개발용 운영자 mock 로그인. TBD: 관리자 인증(SSO · 2FA · IP 제한), 관리자 세부 권한, 로그 보관 기간 |

| `/admin/members` 회원 관리 · `/admin/members/[id]` 회원 상세 · `/admin/creators` 크리에이터 관리 (`features/admin/members/*`) | admin members PR | 검색 (닉네임 · ID · 회원 번호) · 역할 · 상태 필터 · 페이지, 상세 정보, 이용 정지 (1 · 7 · 30일 · 무기한, 사유 필수) / 해제 (사유 필수), 처리 이력(감사 로그). 정지 중: 회원 로그인 차단 · 세션 무효, 크리에이터 채널은 공개 화면에서 숨김. 로그인 화면 "이용이 정지된 계정" 문구. TBD: 정지 사유 기준 · 이의 제기 · 정지 중 FN · 정산 처리, 개인정보 열람 권한 |

| `/admin/payments` 결제 · 환불 (충전 내역 · 환불 요청 탭) · `/admin/donations` 후원 운영 (`features/admin/payments/*`) + 회원 FN 충전내역 환불 상태 | admin payments PR | 충전 거래 목록(회원 · 수단 · 상태 · 거래 번호), 환불 요청 심사(승인 = 서버에서 FN 회수 · 보유 FN 부족 시 불가, 거절 = 메모 안내, 처리 메모 필수 · 최종 · 감사 로그), 회원 화면에 "환불 완료 / 환불 거절" 표시; 후원 상태별 · 유형별 합계와 목록(조회 전용). TBD: 결제대행사 결제 취소(원화), 부분 사용 충전 환불, 후원 취소 · 환불 규칙 |

## Figma

구현된 전체 화면 캡처는 [current-build.md](current-build.md)의 새 파일(Somnation — 현재 구현)에 있어요. 펀페이 파일에 잠시 두었던 "코드 우선 화면" 페이지는 2026-09-30에 삭제했어요.
