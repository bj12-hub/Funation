# Somnation 사이트 — 편집 가능한 디자인 (현재 구현 파일 7–9 페이지)

사이트 화면을 **레이어 · 컴포넌트로 직접 편집할 수 있게** 다시 그리는 작업이에요. 1–6 페이지의 화면 캡처(이미지)는
참고용으로 두고, 새 디자인은 여기서 만들어요. 2026-10-02 시작, 통합 채팅부터 단계적으로 넓혀요.

- 파일: [Somnation — 현재 구현 (2026-09)](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj) (`PMnjPwrD3nAiItJxjaZ0qj`)
- 테마: 변수 모드 **Dark**(기본) · **Light** — 코드 `[data-theme]`와 같아요
- 글꼴: Gothic A1 (코드 `--font-sans`)

## 페이지

| 페이지 | 노드 | 내용 |
|---|---|---|
| 7 디자인 · Foundations | `43:2` | 색 · 글자 · 모서리 견본 — Dark `52:2` · Light `52:211` |
| 8 디자인 · Components | `43:3` | 기본 · 조합 컴포넌트 |
| 9 레이아웃 · 스튜디오 | `43:4` | 컴포넌트로 조합한 스튜디오 화면 |

## 토큰

| 컬렉션 | 변수 | CSS (`apps/web/src/styles/tokens.css`) |
|---|---|---|
| Site Color (Dark · Light) | `bg/page · bg/subtle` | `--color-bg-page · --color-bg-subtle` |
| | `surface/default · raised · strong` | `--color-surface · --color-surface-raised · --color-surface-strong` |
| | `border/default · strong` | `--color-border · --color-border-strong` |
| | `text/primary · secondary · tertiary · on-accent` | `--color-text-*` |
| | `primary/default · light · soft`, `nav/active-bg`, `accent/default` | `--color-primary*`, `--color-nav-active-bg`, `--color-accent` |
| | `status/*` (info · success · danger · warning · error-text …) | `--color-info`, `--color-success*`, `--color-danger*`, `--color-error-text`, `--color-warning-text` |
| | `chip/bg · input/bg · neutral/soft` | `--color-chip-bg · --color-input-bg · --color-neutral-soft` |
| Site Dimension | `radius/4 · 6 · 8 · 12 · 16 · 20 · pill` | `--radius-*` |
| | `space/4 … 40` | 코드는 px 값을 직접 써요 (간격 토큰 없음) |

변수의 WEB 코드 문법이 CSS 변수 이름과 같아요. 기본 버튼의 그라데이션(`--gradient-primary-button`)은 피그마에서
변수로 연결할 수 없어 값으로 넣었어요.

텍스트 스타일 `Site/*`: Page Title 24 Black · Card Title 18 ExtraBold · Subtitle 15 · Body 14 · Body Strong 14 SemiBold ·
Small 13 · Small Strong 13 SemiBold · Caption 12 · Label 11 Bold · Nav 14 Medium · Overlay 18 · Overlay Name 18 Bold.

## 컴포넌트 ↔ 코드

| 컴포넌트 | 노드 | 속성 | 코드 |
|---|---|---|---|
| Platform Mark | `45:18` | Platform (YouTube · Chzzk · SOOP · FlexTV) × Size | `features/broadcast/PlatformMark.tsx` |
| Button | `45:37` | Style (Primary · Ghost · Danger) × Size (Default · Mini) × State, Label | `crew.module.css .primary/.ghost/.danger`, `chat.module.css .mini` |
| Input · Select · Checkbox | `45:44` · `45:45` · `45:58` | State · Value · Checked/Disabled, Label | `crew.module.css .input/.select/.checkRow` |
| Filter Chip | `45:71` | State, Label, Show mark, Mark | `chat.module.css .filterChip` |
| Role Chip · Capability Chip · Send Result | `45:72` · `45:80` · `45:93` | Label, State/Status, Mark | `chat.module.css .role/.cap/.results` |
| Studio Nav Item | `45:100` | State (Default · Active), Emoji, Label | `studio.module.css .sideItem` |
| Studio Header · Studio Sidebar | `46:8` · `46:20` | Channel · 메뉴는 `CreatorSideNav.tsx`와 같음 | 스튜디오 레이아웃 |
| Chat Line | `46:149` | State (Default · Hover · Hidden), Platform, Nick, Message, Time, Show role, Show flag | `UnifiedChatScreen.tsx` Line |
| Channel Card | `46:206` | Status (Connected · Disconnected · YouTube link), Platform, Name, Info | `UnifiedChatScreen.tsx` Channels |
| Overlay Chat Line | `46:208` | Platform, Name, Message, Show role | `chatOverlay.module.css` |

## 레이아웃 (9 레이아웃 · 스튜디오)

섹션은 스튜디오 메뉴 순서예요. 화면은 실제 화면의 구조(레이아웃 · 간격 · 색 · 글자)를 읽어 만든 편집 가능한 프레임이고,
색은 변수, 글자는 텍스트 스타일, 버튼 · 입력창 · 헤더 · 사이드바는 컴포넌트예요. 화면 속 이름 · 숫자는 예시 값이에요.

| 섹션 | ID | 화면 | 라우트 | 노드 |
|---|---|---|---|---|
| 통합 채팅 | C01 | 통합 채팅 | `/creator/chat` | `49:2` |
| 통합 채팅 | O04 | 통합 채팅 오버레이 (400 × 600) | `/overlay/chat/[key]` | `49:504` |
| 대시보드 · 수익 · 소식 | T01 | 대시보드 | `/creator` | `59:443` |
| 대시보드 · 수익 · 소식 | T02 | 수익 현황 | `/creator/revenue` | `59:808` |
| 대시보드 · 수익 · 소식 | T02b | 크리에이터 랭킹 | `/creator/ranking` | `61:646` |
| 대시보드 · 수익 · 소식 | T05 | 업데이트 소식 | `/creator/updates` | `61:968` |
| 채널 | H01 | 채널 설정 (계정설정) | `/creator/settings` | `62:846` |
| 채널 | H02 | 후원 페이지 설정 | `/creator/donations?tab=settings` | `62:1111` |
| 채널 | H03 | 칭호 관리 | `/creator/donations?tab=titles` | `62:1332` |
| 채널 | Y01 | 유튜브 연동 | `/creator/youtube` | `62:1539` |
| 채널 | Y02 | 영상 목록 | `/creator/videos` | `63:1255` |
| 방송 · 위젯 | W01 | 위젯 목록 | `/creator/widgets` | `63:1485` |
| 방송 · 위젯 | W02 | 방송 도구 | `/creator/widgets/tools` | `64:1471` |
| 방송 · 위젯 | W03 | 오버레이 주소 | `/creator/widgets/overlays` | `64:1678` |
| 방송 · 위젯 | W04 | 리모컨 | `/creator/remote` | `64:1972` |
| 방송 · 위젯 | W05 | 이펙트 · 효과 | `/creator/widgets/effects` | `66:1840` |
| 방송 · 위젯 | W06 | 시그니처 후원 (편집 열림) | `/creator/widgets/signatures` | `66:2016` |
| 방송 · 위젯 | W07 | 영상 후원 | `/creator/widgets/video` | `66:2322` |
| 방송 · 위젯 | W08 | 그림후원 | `/creator/widgets/drawing` | `66:2498` |
| 방송 · 위젯 | W09 | 이미지·사운드 | `/creator/widgets/assets` | `66:2653` |
| 방송 · 위젯 | W10 | 배너 | `/creator/widgets/banner` | `66:2782` |
| 방송 · 위젯 | W11 | 후원 연동 | `/creator/widgets/link` | `67:2520` |
| 크루 방송 | Y03 | 크루 관리 | `/creator/crew` | `67:2696` |
| 크루 방송 | Y04 | 크루 방송 운영 | `/creator/crew/broadcast` | `67:2905` |
| 후원 관리 | T03 | 받은 후원 | `/creator/donations?tab=list` | `67:3046` |
| 후원 관리 | T03b | 후원 순위 | `/creator/donations?tab=ranking` | `68:2958` |
| 후원 관리 | T03c | 후원 필터링 | `/creator/donations?tab=filtering` | `68:3293` |
| 정산 | T04 | 정산 현황 + 체크리스트 | `/creator/settlement` | `68:3459` |
| 정산 | T04b | 정산 인증·등록 (이용동의) | `/creator/settlement/register` | `68:3655` |
| 정산 | T04c | 정산 자료 등록 | `/creator/settlement/register/form` | `69:3359` |

아직 없는 화면: **정산 신청**(`/creator/settlement/apply`) · **정산 관리**(`/creator/settlement/manage`). 정산 등록(주민등록번호 · 계좌)을 마쳐야 열리는 화면이라, 개인 · 금융 정보 입력이 필요해 이번에는 만들지 않았어요.

다음 단계: 사이트(홈 · 채널 · 후원 · 마이 · 지갑) 화면을 같은 방식으로 옮겨요. 화면 속 이름 · 숫자는 예시 값이에요.
