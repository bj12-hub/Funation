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
| 후원하기 확인 "후원 알림 미리보기" (`creatorRoom/DonationDialogs.tsx`) | alert-badges PR | 확인 팝업(613:6) 아래 OBS 알림 카드 모양: 서버가 계산한 별명 + 등급 · 글로벌 칭호 · 이 크리에이터 칭호 (`getAlertBadges`), 불러오는 중 / 실패 상태. 프로필 숨기기는 익명 · 배지 없음(TBD: 최종 표시 규칙). 실제 OBS 알림(`AlertOverlay.tsx`)도 같은 이름과 배지를 표시. Figma 레이아웃: D-confirm `112:8173`, O02b `112:8207` |

| `/creator/crew` 크루 관리 (`features/creatorStudio/crew/CrewScreen.tsx`) + sidebar "👥 크루 관리" | crew members PR | Member list (add / 휴식·활동 / rename / delete), 이번 달 멤버별 순위 bars |
| 후원 패널 "멤버 지정 (선택)" chips (`creatorRoom/DonationForm.tsx`) | crew members PR | Shown only when the creator has active crew members (mock: c4) |

| `/creator/crew/broadcast` 방송 운영 (`crew/BroadcastScreen.tsx`) + 멤버/방송 운영 tabs | crew broadcast PR | Start form (팀 배틀 배정), live scoreboard with 보정 buttons, team gauge, 보정 로그, OBS 주소, 방송 이력 |
| 방송 운영 "후원 리스트" (`crew/BroadcastFeed.tsx`) + 시작 폼 "프로젝트" | crew broadcast v3 PR | 멤버 키워드, 반영 방식 (자동 / 확인 후), 시뮬 후원, 한방 (시작 · STOP 몰아주기 · 취소), 필터 (전체 · 미지정·대기 · 반영 · 취소 건), 멤버 배정 select; 프로젝트 · 회차 chip on live title and history |
| 방송 운영 "자동엑셀" (`crew/ExcelPanel.tsx`, `BroadcastFeed.tsx`) | auto-excel PR | 점수 기준 (FN 그대로 / 원화 환산), 단위별 환산값 직접 입력 (FN · USD · JPY · 별풍선 · 치즈 · FlexTV 후원, 기본값 없음 — TBD), 배수 규칙 (기준 금액 이상 ×배수, 최대 5개), 후원별 기여도 (규칙 / 점수 / 배수 수기 입력), 플랫폼 · BJ별 기여도 표, 시뮬 후원 단위 선택, 후원 연동 이벤트가 후원 리스트에 들어옴. 저장 버튼 없이 입력 즉시 반영 Figma: Y04b `117:3911`. |
| 방송 운영 "실시간 배틀" (`crew/BattlePanel.tsx`) + OBS `/overlay/crew/[key]?battle` | crew battle PR | BJ 1:1 또는 A팀 vs B팀(팀 배틀 방송), 배틀 시간(분 · 3/5/10분 프리셋), 남은 시간 표시, ±30초 · ±1분, 지금 끝내기, 줄다리기 게이지, 앞서는 중 / 승리 · 무승부, 배틀 기록, 오버레이 주소 복사. 점수 = 배틀 중 받은 자동엑셀 점수(보정 제외). TBD: 배틀 배수 · 벌칙 · 상금 Figma: Y04b `117:3911`, O06b `119:8173`. |
| 방송 운영 "기여도 강탈 룰렛" (`crew/StealPanel.tsx`) + OBS `/overlay/crew/[key]?steal` | contribution-steal PR | 룰렛 칸 직접 만들기 (이름 · 비율% / 고정 점수 / 꽝 · 가중치, 최대 12칸, 확률 표시, 기본 칸 없음 — TBD), 가져올 BJ ← 빼앗길 BJ (BJ 1:1 배틀 중이면 두 BJ가 기본), 서버 추첨 후 휠 회전 애니메이션, 결과 문구, 강탈 기록, 점수판 "강탈 ±" 표시, 오버레이는 최근 결과 15초 표시. 빼앗는 점수는 상대 현재 점수 이하. TBD: 기준 점수(방송 전체 vs 배틀), 쿨다운, 후원 연동 자동 룰렛 Figma: Y04b `117:3911`, O06c `119:8191`. |
| 방송 운영 "콘텐츠 시나리오" (`crew/ScenarioPanel.tsx`) + OBS `/overlay/crew/[key]?scenario` | scenario-helper PR | 방송 전에도 편집: 1부~5부 이름 · 예정 시간(분) · 메모 · "시작할 때 서브 점수판 열기" (입력 즉시 저장). 방송 중: 부 단계 표시, N부 시작 / 다음 부로 / 시나리오 마치기, 현재 부 경과 시간 / 예정 시간(초과 시 강조), 메모. 진행 중 방송은 첫 부 시작 때의 시나리오로 진행. 오버레이: 현재 부 · 경과 · 다음 부. TBD: 부별 상금 · 미션, 시간 초과 알림 소리 Figma: Y04 `116:3886` (편집) · Y04b `117:3911` (진행), O06d `119:8199`. |
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
| 오버레이 주소 "기능 제어 OFF" 표시 (`widgets/OverlayUrlsScreen.tsx`) | overlay-urls-off PR | 리모컨 기능 제어에서 꺼진 오버레이: 상단 요약(꺼진 오버레이 N개 · 이름 · 리모컨 링크), 줄에 OFF 배지 · 설명(OBS 소스는 그대로, 화면 · 소리 없음) · "켜기" 버튼(바로 ON). Figma: W03 `136:4527` (배너 OFF 예시) |
| `/overlay/alert/[key]` OBS 후원 알림 (`remote/AlertOverlay.tsx`) | alert remote PR | Transparent source (800 × 600), pop-in card, browser TTS; per-type styles and sounds TBD |
| `/overlay/tool/[tool]/[key]` OBS overlays (`widgets/ToolOverlay.tsx`) | broadcast tools PR | Transparent sources for subtitle · marquee · timer · credits; styles/fonts TBD; 이모지·레이어 효과 still planned |

| 후원관리+ 후원 리스트 "CSV 다운로드" (`donations/CsvExportButton.tsx`) | donations csv PR | Button beside 검색; exports the current filters (all pages, max 5,000 rows), UTF-8 BOM, result note |

| `/creator/updates` 업데이트 소식 (`features/creatorStudio/updates/*`) + 대시보드 "업데이트 소식" card + sidebar "📰 업데이트 소식" | creator updates PR | Posts (NEW mark, 신규 · 개선 · 버그 수정 counts, date), expandable item lists with links; read state on the server |

| 라이트 테마 (`styles/tokens.css` [data-theme="light"]) + 헤더 ☀️/🌙 토글 (`components/layout/ThemeToggle`) | light theme PR | Main site only; creator studio, OBS overlays and the home notice popups stay dark. Light values for every surface/text/border/form token need a Figma pass |

| 리모컨 "방송 도구" card (`remote/ToolsRemote.tsx`) + 전체 제어 "TTS 스킵" · "오버레이 새로고침"; 방송 도구 타이머 퀵 조정 · 크레딧 시작/중지 | remote controls PR | Timer ±30/60초, 시작/재개/일시정지/초기화; 엔딩 크레딧 시작 · 처음부터 · 중지 (overlay shows credits only while rolling) |
| 리모컨 "기능별 새로고침" card (`remote/RemoteScreen.tsx`) + 전체 제어 "전체 오버레이 새로고침" | overlay-reload PR | 오버레이마다 따로 새로고침: 후원 알림 · 이펙트 · 영상 후원 · 그림 후원 · 배너 · 자막 · 전광판 · 타이머 · 엔딩 크레딧 · 통합 채팅 · 크루 점수판(배틀 · 강탈 · 시나리오 포함). 다른 오버레이는 그대로, 다음 읽기(몇 초) 때 반영 (기능 제어 카드로 대체) |
| 리모컨 "기능 제어" · "볼륨 제어" cards (`remote/RemoteScreen.tsx`; replaces the 기능별 새로고침 card) | overlay-switches PR | 위플랩 리모컨처럼 오버레이마다 ON/OFF + ↻ 새로고침 한 줄씩 (OFF = 화면 · 소리 없음, OBS 소스는 유지, 끈 동안 지나간 알림은 다시 나오지 않음). 볼륨: 후원 알림음 · 후원 TTS · 영상 후원(영상 오버레이에 YouTube IFrame API로 적용). 전체 음소거 안내 Figma: W04 `121:4113`. |

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
| `/overlay/chat/[key]` 통합 채팅 오버레이 (`features/broadcast/ChatOverlay.tsx`) + 오버레이 주소 "채팅" 그룹 | unified-chat overlay PR | 투명 배경, 최근 12줄, 플랫폼 표시 · 닉네임 · 매니저/스트리머 표시, 1초마다 다시 읽기(숨김 · 삭제 · 차단 · 금칙어는 바로 사라짐), 권장 400 × 600. 후원 알림 카드에 플랫폼 표시 추가, 후원 연동 테스트 후원을 모든 플랫폼(치즈 · 별풍선 · FlexTV 단위 TBD)으로 확장 — 모든 플랫폼 후원이 대기열 하나에서 하나씩 재생. TBD: 오버레이 스타일 옵션(글꼴 · 줄 수 · 테마), 푸시 전송 |
| `/creator/chat` 통합 채팅 (`features/broadcast/UnifiedChatScreen.tsx`) + sidebar "💬 통합 채팅" | unified-chat studio PR | weflab 채팅창 참고. 플랫폼 필터 · 검색 · 숨긴 메시지 보기, 메시지별 숨김(오버레이만) / 삭제 · 차단(플랫폼, CHAT_MODERATE 있는 곳만, 기간 5분·1시간·1일·영구), 통합 입력(보낼 플랫폼 선택, 플랫폼별 결과, 실패한 곳만 다시 보내기), 채널 연결(치지직 · SOOP · FlexTV는 채널 아이디, YouTube는 유튜브 연동) + 기능 표시 · API 확인 중, 관리 기록, 개발용 테스트 채팅 · 재연결. TBD: 플랫폼 로그인(OAuth), 실시간 전송, 매니저 계정 |
| `/popout/chat` 채팅창 링크 (`UnifiedChatScreen` variant "window", `app/popout`) + 통합 채팅 "🔗 채팅창 링크" card | chat-window PR | 스튜디오 메뉴 없이 채팅만 창 전체에: 채팅(플랫폼 필터 · 검색 · 숨김 · 삭제 · 차단) + 통합 입력, "채널 연결 · 관리 기록 ↗". 크리에이터 로그인 필요(없으면 로그인 후 돌아옴). 새 창으로 열기(440×780) · 링크 복사. 매니저용은 아래 매니저 채팅창 링크 Figma: C02 `120:8188` · C02b `127:3` (마우스 올림), C01 `49:2` (카드). |
| `/popout/chat/m/[token]` 매니저 채팅창 링크 + 통합 채팅 "👥 매니저 채팅창 링크" card (`UnifiedChatScreen.tsx` ManagerLinks · ManagerChatScreen) | manager-chat-link PR | 매니저마다 링크(최대 5개, 이름 12자) · 권한 체크박스(보기 고정 + 숨김 / 삭제 · 차단 / 통합 입력, 새 링크는 숨김만) · 링크 복사 · 마지막 사용 · 삭제(즉시 끊김). 매니저 화면: 허용된 동작만 보이고 통합 입력은 권한 있을 때만, 헤더에 매니저 이름 · 권한, 삭제되면 "사용할 수 없는 링크" 안내. 관리 기록에 "매니저 이름" 표시. 로그인 없음(토큰 192비트), noindex · no-referrer. TBD: 만료 기간, 매니저 계정 Figma: C01 `49:2` (카드 · 관리 기록), C03 `123:8244` (숨김만) · C03b `125:2` (숨김만 · 마우스 올림), C04 `123:8311` (전체 권한, 터치 화면처럼 버튼 항상 표시), C04b `124:110` (데스크톱 · 메시지에 마우스를 올렸을 때 오른쪽 위 버튼). |
| 헤더 알림 (`GlobalHeader/NotificationBell.tsx`) + `/notifications` (`features/notifications/NotificationsScreen.tsx`) | notifications PR | 사이트 · 스튜디오 헤더 벨: 안 읽음 배지 (30초 폴링, 탭이 보일 때만), 팝오버 최근 8개 · 모두 읽음 · 전체 보기; 전체 페이지 전체 / 안 읽음 · 더 보기. 알림 출처: 후원 완료 (요청 재시도 시 1회), 내 채널 후원 받음, FN 충전 완료, 공지 · 안내 시드. 최근 100개 보관. TBD: 알림 종류 설정, 푸시 · 이메일, 보관 기간, 사용자별 수신함 |

Add a row whenever a new code-first screen ships (see `docs/research/funnation-reference.md` for the planned features).

| `/admin` 관리자 콘솔 (`features/admin/*`, `app/admin/(console)`) + `/admin/login` + `/admin/audit` | admin shell PR | 관리자 전용 헤더 · 사이드바 (회원 · 거래 · 운영 그룹, 미구현 항목은 준비 중), 운영 대시보드 (크리에이터 · 이번 달 충전 · 후원 · 처리 대기), 감사 로그 (수정 불가 기록), 개발용 운영자 mock 로그인. TBD: 관리자 인증(SSO · 2FA · IP 제한), 관리자 세부 권한, 로그 보관 기간 |

| `/admin/members` 회원 관리 · `/admin/members/[id]` 회원 상세 · `/admin/creators` 크리에이터 관리 (`features/admin/members/*`) | admin members PR | 검색 (닉네임 · ID · 회원 번호) · 역할 · 상태 필터 · 페이지, 상세 정보, 이용 정지 (1 · 7 · 30일 · 무기한, 사유 필수) / 해제 (사유 필수), 처리 이력(감사 로그). 정지 중: 회원 로그인 차단 · 세션 무효, 크리에이터 채널은 공개 화면에서 숨김. 로그인 화면 "이용이 정지된 계정" 문구. TBD: 정지 사유 기준 · 이의 제기 · 정지 중 FN · 정산 처리, 개인정보 열람 권한 |

| `/admin/payments` 결제 · 환불 (충전 내역 · 환불 요청 탭) · `/admin/donations` 후원 운영 (`features/admin/payments/*`) + 회원 FN 충전내역 환불 상태 | admin payments PR | 충전 거래 목록(회원 · 수단 · 상태 · 거래 번호), 환불 요청 심사(승인 = 서버에서 FN 회수 · 보유 FN 부족 시 불가, 거절 = 메모 안내, 처리 메모 필수 · 최종 · 감사 로그), 회원 화면에 "환불 완료 / 환불 거절" 표시; 후원 상태별 · 유형별 합계와 목록(조회 전용). TBD: 결제대행사 결제 취소(원화), 부분 사용 충전 환불, 후원 취소 · 환불 규칙 |

| `/admin/settlements` 정산 심사 (`features/admin/settlements/*`) + 스튜디오 정산 관리 반려 사유 | admin settlements PR | 정산 등록 정보(마스킹), 상태 탭(전체 · 심사 대기 · 승인 · 반려), 신청별 금액 · 기간 · 수수료 · 실지급 · 지급 예정일, 승인 / 반려(처리 메모 필수 · 최종 · 감사 로그), 반려 시 실지급 0 · 지급일 해제 · 신청 금액을 신청 가능 금액으로 반환; 크리에이터 정산 관리 표에 반려 사유 표시. TBD: 서류 심사 · 실제 지급(이체) · 정책 수치 |

| `/admin/content` 콘텐츠 관리 (공지사항 · 자주 묻는 질문 탭, `features/admin/content/ContentManager.tsx`) | admin content PR | 공지 등록 · 수정 · 삭제(분류 · 중요 고정 · 제목 · 요약 · 본문 문단), FAQ 등록 · 수정 · 삭제(분류 · 질문 · 답변 비우면 준비 중 · 사이트 내부 링크만), 고객센터가 같은 데이터를 읽어 즉시 반영, 새 공지는 사이트 알림 발송, 모든 변경 감사 로그. TBD: 예약 게시 · 게시 기간 · 이미지 첨부 · 승인 절차 |

| `/admin/platforms` 플랫폼 연동 · `/admin/system` 시스템 (`features/admin/system/SystemScreens.tsx`) + 사이트 공지 배너 (`components/layout/SiteBanner`) | admin platform-system PR | 플랫폼별 어댑터 지원 기능 · 스튜디오 연결 · 동기화 · 후원 연동 · 연결 확인(지연 시간 · 오류 코드); 사이트 공지 배너(안내 / 주의, 문구 120자, 내부 링크, 켜기 · 끄기, 감사 로그) — 사이트 모든 페이지 상단 표시; 실행 환경 정보. 운영자 세션은 회원 세션과 분리(사이트에서는 비로그인). TBD: 배너 예약 · 여러 배너, OAuth · 웹훅 · 할당량 모니터링 |

| 관리자 콘솔 → 별도 앱 `apps/admin` (http://localhost:3200) | separate admin app PR | 위 `/admin/*` 화면을 사이트에서 분리: 어드민 앱 라우트는 `/`, `/audit`, `/members`, `/creators`, `/payments`, `/donations`, `/settlements`, `/content`, `/platforms`, `/system`, `/login`. 데이터는 사이트 관리자 API(`/api/admin/*`)로만 읽고 씀. 사이트의 `/admin`은 삭제 |

| 신고 · 차단: 커뮤니티 글 · 댓글, 채널 커뮤니티 글, 받은 쪽지, 크리에이터 채널의 "신고" (+ 작성자 "차단") (`features/moderation/ModerationActions.tsx`), `/mypage/blocks` 차단 관리, 어드민 앱 `/reports` 신고 처리 | report-block PR | 신고 사유 6종(스팸 · 욕설 · 음란 · 개인정보 · 사칭 · 기타, 기타는 내용 필수) + 상세, 회원 · 대상별 1회, 신고 당시 내용 스냅샷; 차단 시 해당 작성자의 글 · 댓글 · 채널 글 · 쪽지가 보이지 않음(상대에게 알리지 않음), 작성자 id는 서버에서만 확인; 운영자 숨김 / 기각(메모 필수 · 최종 · 감사 로그, 같은 콘텐츠 신고 일괄 종료), 대시보드 신고 대기 건수. TBD: 사유별 처리 기준 · 제재 단계 · 이의 제기, 신고 남용 방지 |

| 공통 404 (`components/layout/NotFoundView`: `app/not-found.tsx` 단독 · `(main)/not-found.tsx` 사이트 헤더 · 메뉴 유지) + `(main)/error.tsx` 공통 오류 + `app/global-error.tsx` + 오버레이 빈 404 | not-found PR | 404 숫자 · "페이지를 찾을 수 없어요" · 삭제/비공개 사유를 밝히지 않는 문구 · 홈 / 크리에이터 찾기 / 고객센터 링크; OBS 오버레이는 잘못된 키에 아무것도 표시하지 않음 |

## Figma

구현된 전체 화면 캡처는 [current-build.md](current-build.md)의 새 파일(Somnation — 현재 구현)에 있어요. 펀페이 파일에 잠시 두었던 "코드 우선 화면" 페이지는 2026-09-30에 삭제했어요.
