# Ssumnation 사이트 — 편집 가능한 디자인 (현재 구현 파일 7–11 페이지)

사이트 화면을 **레이어 · 컴포넌트로 직접 편집할 수 있게** 다시 그리는 작업이에요. 1–6 페이지의 화면 캡처(이미지)는
참고용으로 두고, 새 디자인은 여기서 만들어요. 2026-10-02 시작, 통합 채팅부터 단계적으로 넓혀요.

- 파일: [Ssumnation — 현재 구현 (2026-09)](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj) (`PMnjPwrD3nAiItJxjaZ0qj`)
- 테마: 변수 모드 **Dark**(기본) · **Light** — 코드 `[data-theme]`와 같아요
- 글꼴: Gothic A1 (코드 `--font-sans`)

## 페이지

| 페이지 | 노드 | 내용 |
|---|---|---|
| 7 디자인 · Foundations | `43:2` | 색 · 글자 · 모서리 견본 — Dark `52:2` · Light `52:211` |
| 8 디자인 · Components | `43:3` | 기본 · 조합 컴포넌트 |
| 9 레이아웃 · 스튜디오 | `43:4` | 컴포넌트로 조합한 스튜디오 화면 |
| 10 레이아웃 · 사이트 | `74:2` | 컴포넌트로 조합한 사이트 화면 (헤더 · 사이드 메뉴 · 푸터 인스턴스) |
| 11 레이아웃 · 오버레이 테마 | `258:333` | OBS 오버레이를 테마별(볼드 플랫 · 미니멀 필 · 소프트 글래스)로 그린 프레임 + 스튜디오 오버레이 테마 카드 |
| 12 레이아웃 · 도우미 | `326:655` | Ssumnation 도우미(새 도메인, 2026-10-14) — 도우미 틀 · 위젯 기능 페이지 · 리모컨 · 모바일 (아래 "레이아웃 (12 레이아웃 · 도우미)") |

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

Light 모드 값은 코드의 라이트 테마 대비 정리(WCAG AA, #172 · #176)와 맞췄어요 (2026-10-06): `text/tertiary` `#646675`,
`primary/default` `#7c3aed`, `accent/default` `#db2777`, `status/info` `#2563eb`, `status/success` · `success-text` `#047857`,
`status/danger` `#c81e1e`, `status/error-text` `#b91c1c`. Dark 모드(Figma 원본)는 그대로예요. S02 라이트 홈의 변수에 연결되지 않은
다크 전용 값(헤더 메뉴 선, 충전 파랑, 연회색 글자, 검은 푸터)도 라이트 값으로 바꿨어요.

2026-10-17 라이트 대비 2차(#332): 글자 전용 변수 3개를 더했어요. Dark는 원래 색 그대로, Light만 진한 값이에요 —
`primary/text` (Dark `#a78bfa` · Light `#6d28d9`, `--color-primary-text`), `status/live-text` (`#f5bf0a` · `#8a6100`,
`--color-live-text`), `status/highlight-text` (`#06b6d4` · `#0e7490`, `--color-highlight-text`). 그라데이션 버튼 글자 27곳
(로그인 · 회원가입 · 비밀번호 · 닉네임 중복 확인 · 신고 · 확인 등)은 `text/primary` 대신 `text/on-accent`에 연결했어요.
같은 날 로그인 · 가입 · 비밀번호 · 404 · 도우미 로그인 카드의 로고(22곳)가 그라데이션 상자로 그려져 있던 것을
글자 그라데이션으로 고쳤어요. `--color-platform-offline`은 Figma 변수가 없어 그대로예요.

텍스트 스타일 `Site/*`: Page Title 24 Black · Card Title 18 ExtraBold · Subtitle 15 · Body 14 · Body Strong 14 SemiBold ·
Small 13 · Small Strong 13 SemiBold · Caption 12 · Label 11 Bold · Nav 14 Medium · Overlay 18 · Overlay Name 18 Bold.

### 오버레이 테마 (Overlay Theme 컬렉션, 2026-10-08)

OBS 오버레이의 세 테마는 변수 컬렉션 **Overlay Theme**의 모드예요: **미니멀 필**(기본) · **볼드 플랫** · **소프트 글래스** — 코드
`[data-ov="PILL" | "BOLD" | "GLASS"]`(`features/overlayTheme/overlayTheme.module.css`)와 같아요. 프레임이나 인스턴스의 변수 모드만 바꾸면
같은 레이아웃이 다른 테마로 바뀌어요.

| 변수 | 볼드 플랫 · 미니멀 필 · 소프트 글래스 | CSS |
|---|---|---|
| `ov/accent · ov/accent-ink` | `#FFD23F`/`#111` · `#8B5CF6`/`#fff` · `#FFC6DD`/`#111` (테마 기본 포인트 색, `readableInk`) | `--ov-accent · --ov-accent-ink` |
| `ov/card/bg · ink · muted · border` | 흰 카드 + 검은 선 · 어두운 알약 카드 · 반투명 흰 카드 | `--ov-card-*` |
| `ov/card/radius · border-width` | 14 · 22 · 24 / 2.5 · 1 · 1 | `--ov-card-radius · --ov-card-border` |
| `ov/chip/* · ov/track/* · ov/fill/*` | 칩 · 진행 막대 바탕 · 막대 채움(볼드는 오른쪽 검은 선, 각진 끝) | `--ov-chip-* · --ov-track-* · --ov-fill-edge` |
| `ov/on-stream · ov/on-stream/*` | 방송 위 글자 색과 그림자(볼드는 검은 외곽선) | `--ov-on-stream · --ov-on-stream-shadow` |
| `ov/font/display · display-style` | Archivo Black · Inter Extra Bold · Fredoka Bold | `--ov-display-font · --ov-display-weight` |
| `ov/font/display-ko-style` | 한글이 들어간 큰 글자: Gothic A1 Black · ExtraBold · Bold (세 숫자 글꼴에 한글이 없어 코드에서도 Gothic A1로 그려져요) | — |
| `ov/font/label-style` | Gothic A1 ExtraBold · SemiBold · Bold | `--ov-label-weight` |

역할 변수: `ov/feature/*`(볼드는 강조 카드가 포인트 색 블록 — 후원 알림 · 누적 · 자막 · 타이머 · 시나리오 …), `ov/name/*`(후원 알림 닉네임:
필은 포인트 색 글자, 글래스는 파스텔 배지), `ov/message/*`(볼드 흰 메시지 상자), `ov/capsule/radius`(필에서만 알약), `ov/flip/*` · `ov/dial/*`
(시계), `ov/bingo/*`, `ov/art/*`(그림 액자), `ov/quest/*`, `ov/rank/*`, `ov/shape/*`(하트 · 별 외곽선), `ov/alert/amount-size`(볼드 68 · 나머지 60),
테마별 요소를 켜고 끄는 불리언 `ov/is-bold · is-pill · is-glass · not-bold · not-pill`(채팅 닉네임 색 태그 · 색 점 등).

효과 스타일: `Overlay/Card`(볼드 5px 블록 그림자 · 필 부드러운 그림자 · 글래스 그림자 + 안쪽 하이라이트 + 배경 흐림 14),
`Overlay/On Stream`(방송 위 글자 그림자 · 볼드 외곽선), `Overlay/Block Shadow`(볼드만 4px 블록 그림자: 막대 · 이미지 · 룰렛 · 결과 블록).
모두 변수에 묶여 있어 모드를 따라 바뀌어요.

피그마로 옮기며 단순화한 것: 글래스 카드의 그라데이션(`linear-gradient(135deg, …)` + 보라 틴트)은 반투명 색 하나 + 배경 흐림으로,
등장 · 퇴장 효과와 금액 올라가기는 그리지 않았어요(정지 화면). 볼드 이미지 강조형 금액 블록의 -3° 기울기도 빠져 있어요.

## 컴포넌트 ↔ 코드

| 컴포넌트 | 노드 | 속성 | 코드 |
|---|---|---|---|
| Platform Mark | `45:18` | Platform (YouTube · Chzzk · SOOP · FlexTV) × Size | `features/broadcast/PlatformMark.tsx` |
| Button | `45:37` | Style (Primary · Ghost · Danger) × Size (Default · Mini) × State, Label | `crew.module.css .primary/.ghost/.danger`, `chat.module.css .mini` |
| Input · Select · Checkbox | `45:44` · `45:45` · `45:58` | State · Value · Checked/Disabled, Label | `crew.module.css .input/.select/.checkRow` |
| Filter Chip | `45:71` | State, Label, Show mark, Mark | `chat.module.css .filterChip` |
| Role Chip · Capability Chip · Send Result | `45:72` · `45:80` · `45:93` | Label, State/Status, Mark | `chat.module.css .role/.cap/.results` |
| Studio Nav Item | `45:100` | State (Default · Active), Emoji, Label | `studio.module.css .sideItem` |
| Studio Header · Studio Sidebar | `46:8` · `46:20` | Channel · 메뉴는 `CreatorSideNav.tsx`와 같음 (수익 › 📥 내역 이관 `352:10884`, 2026-10-17) | 스튜디오 레이아웃 |
| Chat Line | `46:149` | State (Default · Hover · Hidden), Platform, Nick, Message, Time, Show role, Show flag | `UnifiedChatScreen.tsx` Line |
| Channel Card | `46:206` | Status (Connected · Disconnected · YouTube link), Platform, Name, Info | `UnifiedChatScreen.tsx` Channels |
| Overlay Chat Line | `46:208` | Platform, Name, Message, Show role | `chatOverlay.module.css` (테마 이전) |
| Overlay/Alert | `249:215` | Layout (Card · Banner · Image) × Size (Default · Vertical), Nick, Headline, Amount, Message, Type, Show message · meta · badge | `remote/AlertCard.tsx` |
| Overlay/Chat Line · Overlay/Chat | `250:310` · `250:557` | 줄: Style (Plain · Box · Bubble · Row · Aligned), Nick, Message, Role / 오버레이: Style 5종 × Size | `broadcast/ChatLines.tsx` |
| Overlay/Goal | `251:1057` | Shape (Bar · Circle · Semi · Heart · Star) × Size, Title, Amount, Percent, Two goals | `widgets/GoalView.tsx` |
| Overlay/Total · Ranking · Recent · Event · QR | `252:496` · `252:499` · `252:528` · `252:553` · `252:578` | 배경 카드 켬 상태 | `widgets/WidgetViews.tsx` |
| Overlay/Mini | `288:508` | Style (Scroll · Bubble) — 스크롤형 = 띠 + 미니 칩 + 흐르는 글, 말풍선형 = 가장 최근 1건. 볼드는 포인트 색 블록(`ov/feature/bg`) | `widgets/WidgetViews.tsx` (MiniView) |
| Overlay/Quest · Vote · Roulette · Gacha · Gacha Board | `253:1455` · `253:1464` · `253:1491` · `253:1515` · `253:1526` | 화려한 퀘스트 · 진행 중 투표 · 돌아가는 룰렛 · 뽑기 당첨 · 당첨 리스트 | `widgets/GameViews.tsx` |
| Overlay/Clock | `254:600` | Style (Flip · Digital · Analog), Show label · date | `widgets/ClockView.tsx` |
| Overlay/Subtitle · Marquee · Timer · Credits · Bingo | `254:601` · `254:603` · `254:607` · `254:609` · `254:631` | — | `widgets/ToolOverlay.tsx` |
| Overlay/Crew Score · Battle · Scenario · Steal | `257:600` · `257:636` · `257:661` · `257:669` | — | `crew/CrewScoreOverlay.tsx` |
| Overlay/Video Caption · Audio Card · Drawing | `257:674` · `257:680` · `257:697` | — | `widgets/media/MediaOverlays.tsx` |
| Overlay/Theme Sample | `260:13093` | Theme (Bold · Pill · Glass) — 변형마다 모드 고정 | `overlayTheme/ThemeSample.tsx` |
| Overlay/Theme Swatch | `267:508` | Theme (Bold · Pill · Glass) — 테마 고르기 칩의 견본 30 × 22 | `overlayTheme/ThemeChoiceField.tsx` `.swatch` |
| Studio/Alert Layout Icon · Studio/Goal Shape Icon | `267:516` · `267:540` | Layout (Card · Banner · Image) / Shape (Bar · Circle · Semi · Heart · Star) | `AlertForm` `.layoutIcon`, `GoalForm` `.icon` |
| Helper Sidebar | `326:529` | 메뉴 항목은 Studio Nav Item 인스턴스(`Nav/<이름>`, State로 현재 메뉴) — 로고 · 프로필 카드(플랫폼 로고 · 로그아웃) · 그룹 6개 · Spacer · 리모컨 버튼 + "이 창에서 열기 · 리모컨 가이드" | `features/helper/HelperShell.tsx`, `helperNav.ts` |
| Helper Top Bar · Helper Mobile Bar | `326:516` · `326:522` | 1440 × 80 (로고 · 도우미 홈) / 375 × 56 (로고 · ☰) | `HelperLanding.tsx` HelperFrame, `HelperShell.tsx` `.topBar` |
| Helper Tab · Helper Save Bar | `326:506` · `326:515` | State (Default · Active), Label / State (Clean · Dirty) — 662 폭 | `WidgetFeaturePage.tsx` `.tab` · `.saveBar` |
| Helper Feature Card · Helper Step Card | `331:557` · `331:563` | Emoji, Title, Description / Number, Title, Text, Link label, Has link | `HelperHome.tsx` · `RemoteGuide.tsx` `.card` · `.step` |

## 아이콘 (8 디자인 · Components → Icons 섹션)

코드의 `apps/web/src/components/icons/index.tsx`(펀페이 Figma에서 옮긴 SVG)와 같은 아이콘 58개를 `Icon/<이름>` 컴포넌트로 만들었어요 (이름 = 코드의 `<이름>Icon`). 설명에 `currentColor`라고 적힌 아이콘은 쓰는 곳의 글자색을 따라요 — 레이아웃에서는 인스턴스의 선 색을 그 자리의 색 변수로 바꿔 두었어요.

레이아웃의 회색 자리표시 사각형 중 실제 SVG 아이콘 자리는 인스턴스로 바꿨어요 (화면 29곳 + 사이트 헤더 · 사이드 메뉴 · 푸터 컴포넌트). 남은 회색 사각형은 썸네일 · 아바타 · 배너 같은 이미지 자리예요. 화면을 다시 읽어 아이콘 순서를 맞추는 방식이라, 레이아웃을 만든 뒤 바뀐 일부(스튜디오 토글 체크, 정산 시작 카드 화살표, 홈 "전체보기" 화살표, FN 충전 약관 체크)는 그대로예요.

## 이미지

레이아웃의 이미지 자리(썸네일 · 프로필 · 배너)는 코드의 목업 이미지로 채웠어요 (303곳). 목업 이미지는 실제 인물 사진이 아니라 `scripts/mock-images`로 그린 일러스트예요. 크리에이터는 가상의 개인방송 BJ · 엑셀방송 크루예요 (예: 하루봄 · 불꽃크루 · 별빛크루). 스튜디오 영상 목록의 YouTube 썸네일 자리는 외부 이미지라 비워 뒀어요.

## 레이아웃 (9 레이아웃 · 스튜디오)

섹션은 스튜디오 메뉴 순서예요. 화면은 실제 화면의 구조(레이아웃 · 간격 · 색 · 글자)를 읽어 만든 편집 가능한 프레임이고,
색은 변수, 글자는 텍스트 스타일, 버튼 · 입력창 · 헤더 · 사이드바는 컴포넌트예요. 화면 속 이름 · 숫자는 예시 값이에요.

| 섹션 | ID | 화면 | 라우트 | 노드 |
|---|---|---|---|---|
| 통합 채팅 | C01 | 통합 채팅 (+ 채팅창 링크 · 매니저 채팅창 링크 카드) | `/creator/chat` | `49:2` |
| 통합 채팅 | C01b | 통합 채팅 · 메시지에 마우스 올림 (데스크톱, 4번째 줄 = Chat Line State=Hover) | `/creator/chat` | `129:2` |
| 통합 채팅 | C02 | 채팅창 링크 (440 × 780, 스튜디오 메뉴 없음) | `/popout/chat` | `120:8188` |
| 통합 채팅 | C02b | 채팅창 링크 · 메시지에 마우스 올림 (데스크톱) | `/popout/chat` | `127:3` |
| 통합 채팅 | C03 | 매니저 채팅창 · 숨김만 (440 × 780) | `/popout/chat/m/[token]` | `123:8244` |
| 통합 채팅 | C03b | 매니저 채팅창 · 숨김만 · 메시지에 마우스 올림 (데스크톱) | `/popout/chat/m/[token]` | `125:2` |
| 통합 채팅 | C03c | 매니저 채팅창 · 사용할 수 없는 링크 (삭제됐거나 잘못된 링크, 440 × 780 — C03 복제 후 수정, code-first) | `/popout/chat/m/[token]` | `321:6` |
| 통합 채팅 | C04 | 매니저 채팅창 · 전체 권한 (440 × 780) | `/popout/chat/m/[token]` | `123:8311` |
| 통합 채팅 | C04b | 매니저 채팅창 · 전체 권한 · 메시지에 마우스 올림 (데스크톱) | `/popout/chat/m/[token]` | `124:110` |
| 통합 채팅 | O04 | 통합 채팅 오버레이 (400 × 600) | `/overlay/chat/[key]` | `49:504` |
| 통합 채팅 | O04b | 통합 채팅 오버레이 · 숨김 반영 후 (400 × 600, C01b에서 숨긴 메시지가 빠진 상태) | `/overlay/chat/[key]` | `130:51` |
| 통합 채팅 | O04c | 통합 채팅 오버레이 · 리모컨 기능 제어 OFF (400 × 600, 아무것도 표시 안 함) | `/overlay/chat/[key]` | `132:2` |
| 대시보드 · 수익 · 소식 | T01 | 대시보드 | `/creator` | `59:443` |
| 대시보드 · 수익 · 소식 | T02 | 수익 현황 | `/creator/revenue` | `200:5365` |
| 대시보드 · 수익 · 소식 | T02b | 크리에이터 랭킹 (퀘스트 탭만) | `/creator/ranking` | `61:646` |
| 대시보드 · 수익 · 소식 | T05 | 업데이트 소식 | `/creator/updates` | `61:968` |
| 채널 | H01 | 채널 설정 (계정설정) | `/creator/settings` | `62:846` |
| 채널 | H02 | 후원 페이지 설정 (빈 대체 메시지 안내 2026-10-06, 주소 규칙 하이픈 3~30자 · 예전 주소 30일 연결 안내 2026-10-08) | `/creator/donations?tab=settings` | `62:1111` |
| 채널 | H03 | 칭호 관리 (익명 후원은 누적 후원 금액 제외 안내, 2026-10-09) | `/creator/donations?tab=titles` | `296:28928` |
| 채널 | Y01 | 유튜브 연동 | `/creator/youtube` | `62:1539` |
| 채널 | Y02 | 영상 목록 | `/creator/videos` | `63:1255` |
| 채널 | Y02b | 영상 목록 · 유튜브에서 지운 · 비공개 영상 "찾을 수 없음" (고정 버튼 비활성, 채널에서 숨김 — 2026-10-08 결정, code-first) | `/creator/videos` | `236:6103` |
| 방송 · 위젯 | W01 | 위젯 목록 (룰렛 포함, 럭키박스 · 플레이 없음) | `/creator/widgets` | `63:1485` |
| 방송 · 위젯 | W01b | 커스텀 사운드 팝업 (라이브러리에서 고르기, 재생 안내 이전 → W12p) | `/creator/widgets` | `144:8419` |
| 방송 · 위젯 | W01c | 뽑기 후원 팝업 (당첨 효과음 · 라이브러리, 테마 이전 → W12m) | `/creator/widgets` | `144:8944` |
| 방송 · 위젯 | W01d | 투표 위젯 팝업 (무료 · 1인 1표, 프리셋, 테마 이전 → W12j) | `/creator/widgets` | `161:9654` |
| 방송 · 위젯 | W01e | 룰렛 설정 팝업 (항목 · 확률, 크리에이터 상품, 테마 이전 → W12k) | `/creator/widgets` | `164:9319` |
| 방송 · 위젯 | W02 | 방송 도구 (빙고 · 1줄 완성 · 화면에 보이는 중, 테마 이전 → W02b) | `/creator/widgets/tools` | `212:5861` |
| 방송 · 위젯 | W03 | 오버레이 주소 (빙고 포함 24개 · OBS 씬 파일 내려받기 · OBS에 한 번에 넣기, 테마 이전 → W03c) | `/creator/widgets/overlays` | `213:5870` |
| 방송 · 위젯 | W04 | 리모컨 (기능 제어 · 볼륨 · 시그니처 소리 · 방송 도구 · 빙고 · 투표 · 룰렛 스위치 · 뽑기 수령 처리) | `/creator/remote` | `218:5994` |
| 방송 · 위젯 | W04q | 리모컨 · 🎯 퀘스트 카드 (진행 중 2건 · 시간 초과 줄, 다른 카드 생략 — 2026-10-18) | `/creator/remote` | `367:12386` |
| 방송 · 위젯 | W04r | 리모컨 · 퀘스트 카드 처리 중 ("처리 중…" · 버튼 잠금) | `/creator/remote` | `367:12535` |
| 방송 · 위젯 | W04s | 리모컨 · 퀘스트 카드 요청 실패 (카드 안 오류 문구) | `/creator/remote` | `367:12685` |
| 방송 · 위젯 | W04t | 리모컨 · 퀘스트 카드 완료 (취소 · 전액 환불 문구) | `/creator/remote` | `367:12835` |
| 방송 · 위젯 | W04u | 리모컨 · 퀘스트 카드 EMPTY | `/creator/remote` | `367:12971` |
| 방송 · 위젯 | W04v | 리모컨 · 퀘스트 시간 연장 입력 ("연장할 시간 [5] 분 · 연장하기 · 닫기", 마감 전 안내 — 2026-10-18) | `/creator/remote` | `369:13035` |
| 방송 · 위젯 | W04w | 리모컨 · 퀘스트 시간 연장 완료 (새 마감 문구 · "연장됨 +10분" 태그) | `/creator/remote` | `369:13199` |
| 방송 · 위젯 | W04x | 리모컨 · 퀘스트 시간 연장 처리 중 ("처리 중…" · 버튼 잠금) | `/creator/remote` | `373:13367` |
| 방송 · 위젯 | W04y | 리모컨 · 퀘스트 시간 연장 · 마감 지난 퀘스트 ("지금부터 다시 계산해요" 안내) | `/creator/remote` | `374:13482` |
| 휴대폰 · 스튜디오 메뉴 | SM1 | 스튜디오 메뉴 · 휴대폰 닫힘 (현재 페이지 바 "🎛️ 리모컨 · 메뉴 ▾", 375 — 2026-10-18) | `/creator/remote` | `368:40223` |
| 휴대폰 · 스튜디오 메뉴 | SM2 | 스튜디오 메뉴 · 휴대폰 열림 (그룹 메뉴 드롭다운, 375) | `/creator/remote` | `368:40266` |
| 방송 · 위젯 | W05 | 이펙트 · 효과 | `/creator/widgets/effects` | `66:1840` |
| 방송 · 위젯 | W06 | 시그니처 후원 (편집 열림) | `/creator/widgets/signatures` | `201:5481` |
| 방송 · 위젯 | W06b | 시그니처 후원 (한 번에 만들기) | `/creator/widgets/signatures?bulk=1` | `209:5689` |
| 방송 · 위젯 | W07 | 영상 후원 (테마 이전 → W07b) | `/creator/widgets/video` | `66:2322` |
| 방송 · 위젯 | W08 | 그림후원 (테마 이전 → W08b) | `/creator/widgets/drawing` | `66:2498` |
| 방송 · 위젯 | W09 | 이미지·사운드 (이름 찾기 · 이름순 · 짝 필터, 5개 중 1개) | `/creator/widgets/assets` | `213:6371` |
| 방송 · 위젯 | W03b | 오버레이 미리보기 (OBS 크기 · 배경 · 테스트 후원) | `/creator/widgets/overlays/preview/[id]` | `200:5999` |
| 방송 · 위젯 | W02b | 방송 도구 (🎨 방송 도구 테마 카드 — 자막 · 전광판 · 타이머 · 엔딩 크레딧 · 빙고가 이 테마) | `/creator/widgets/tools` | `278:9541` |
| 방송 · 위젯 | W03c | 오버레이 주소 (오버레이 테마 줄 · 시계 · 미니후원 · 세로 방송 분류, 29개) | `/creator/widgets/overlays` | `279:9681` |
| 방송 · 위젯 | W03d | 오버레이 미리보기 · 후원 알림 (세로, 1080 × 640을 85%로 · 체크무늬) | `/creator/widgets/overlays/preview/alert-vertical` | `280:9867` |
| 방송 · 위젯 | W07b | 영상 후원 (오버레이 테마 칩 · 재생 중 · 대기열 🎧 음성 · 테스트 "음성 후원으로") | `/creator/widgets/video` | `282:9986` |
| 방송 · 위젯 | W08b | 그림후원 (오버레이 테마 칩 · 받은 그림 없음) | `/creator/widgets/drawing` | `283:10101` |
| 방송 · 위젯 | W01f | 후원랭킹 위젯 팝업 (랭킹 종류 · 수단별 보드, 테마 이전 → W12h) | `/creator/widgets` | `205:15223` |
| 방송 · 위젯 · 설정 팝업 | W12 | 위젯 (오버레이 테마 카드 · 설정 팝업 배경) | `/creator/widgets` | `266:6219` |
| 방송 · 위젯 · 설정 팝업 | W12a | 후원 알림 디자인 팝업 (미리보기 · 테마 · 알림 모양 · 문구 · 움직임) | `/creator/widgets` | `269:6384` |
| 방송 · 위젯 · 설정 팝업 | W12b | 채팅창 위젯 설정 팝업 (스타일 5종 · 닉네임 컬러 · 자동 감추기) | `/creator/widgets` | `270:6582` |
| 방송 · 위젯 · 설정 팝업 | W12c | 후원목표 위젯 설정 팝업 (목표 모양 5종 · 두 번째 목표 · 색상) | `/creator/widgets` | `271:6853` |
| 방송 · 위젯 · 설정 팝업 | W12d | 후원누적금액 위젯 설정 팝업 (배경 카드) | `/creator/widgets` | `271:7487` |
| 방송 · 위젯 · 설정 팝업 | W12e | 최근알림 위젯 설정 팝업 (배경 카드 · 플랫폼별 템플릿) | `/creator/widgets` | `271:8036` |
| 방송 · 위젯 · 설정 팝업 | W12f | 이벤트 위젯 설정 팝업 | `/creator/widgets` | `272:7457` |
| 방송 · 위젯 · 설정 팝업 | W12g | 후원 QR코드 위젯 설정 팝업 | `/creator/widgets` | `272:8044` |
| 방송 · 위젯 · 설정 팝업 | W12h | 후원랭킹 위젯 설정 팝업 (배경 카드 · 스타일 썸네일) | `/creator/widgets` | `272:8909` |
| 방송 · 위젯 · 설정 팝업 | W12i | 퀘스트 위젯 설정 팝업 | `/creator/widgets` | `273:8367` |
| 방송 · 위젯 · 설정 팝업 | W12j | 투표 위젯 설정 팝업 (프리셋 색) | `/creator/widgets` | `273:9009` |
| 방송 · 위젯 · 설정 팝업 | W12k | 룰렛 설정 팝업 | `/creator/widgets` | `274:8772` |
| 방송 · 위젯 · 설정 팝업 | W12l | 시계 위젯 설정 팝업 (플립 · 디지털 · 아날로그) | `/creator/widgets` | `274:9376` |
| 방송 · 위젯 · 설정 팝업 | W12m | 뽑기 후원 위젯 설정 팝업 (오버레이 테마는 시즌 테마와 별개 · 당첨 리스트) | `/creator/widgets` | `276:9170` |
| 방송 · 위젯 · 설정 팝업 | W12n | 벽지 위젯 설정 팝업 (스티커 벽 미리보기) | `/creator/widgets` | `277:9366` |
| 방송 · 위젯 · 설정 팝업 | W12o | 미니후원 위젯 설정 팝업 (테마 · 배경 카드 · 스크롤형 띠 미리보기) | `/creator/widgets` | `289:10324` |
| 방송 · 위젯 · 설정 팝업 | W12p | 커스텀 사운드 팝업 (후원 알림 오버레이에서 재생 안내 · 등록한 사운드 1개) | `/creator/widgets` | `289:10734` |
| 방송 · 위젯 | W10 | 배너 (기능 제어 OFF 안내 · 배너 OFF 예시) | `/creator/widgets/banner` | `66:2782` |
| 방송 · 위젯 | W11 | 후원 연동 (치지직 · SOOP · FlexTV "API 확인 중", SMS 계좌후원 목업) | `/creator/widgets/link` | `229:6102` |
| 크루 방송 | Y03 | 크루 관리 | `/creator/crew` | `200:5757` |
| 크루 방송 | Y04d | 크루 방송 운영 (방송 중 · 랭크업 · OBS 점수판에 표시) | `/creator/crew/broadcast` | `203:5480` |
| 크루 방송 | Y04e | 크루 방송 운영 (방송 중 · 팬 메시지 · 요청사항 · 도배 기준, 다른 카드 생략) | `/creator/crew/broadcast` | `217:5990` |
| 크루 방송 | Y04 | 크루 방송 운영 (방송 전 · 시나리오 편집) — 주소 칸은 연동키를 가린 값 (2026-10-18) | `/creator/crew/broadcast` | `116:3886` |
| 크루 방송 | Y04f | 크루 방송 운영 (방송 전 · OBS 점수판 오버레이 테마 칩) | `/creator/crew/broadcast` | `283:10251` |
| 크루 방송 | Y04b | 크루 방송 운영 (방송 중 · 자동엑셀 · 배틀 · 기여도 강탈 · 시나리오, 예시 입력값) — 주소 칸은 연동키를 가린 값 (2026-10-18) | `/creator/crew/broadcast` | `117:3911` |
| 크루 방송 | Y04c | 크루 방송 운영 (배틀 배수 · 벌칙 기본값, 강탈 기준 · 쿨다운 — 시나리오 · 후원 리스트 카드 생략) — 주소 칸은 연동키를 가린 값 (2026-10-18) | `/creator/crew/broadcast` | `185:5234` |
| 크루 방송 | Y04g | 크루 방송 운영 · 서브 점수판 (방송 중 · 진행 중 판 + 마감 판 구간 TOP 3 · OBS 주소, 다른 카드 생략) | `/creator/crew/broadcast` | `322:10878` |
| 후원 관리 | T03 | 받은 후원 (퀘스트 성공 · 실패 · 취소, 실패 · 취소 시 환불) | `/creator/donations?tab=list` | `204:5585` |
| 후원 관리 | T03b | 후원 순위 | `/creator/donations?tab=ranking` | `68:2958` |
| 후원 관리 | T03c | 후원 필터링 (방송 알림 · TTS 대체 안내 2026-10-06) | `/creator/donations?tab=filtering` | `68:3293` |
| 후원 관리 | T03f | 후원 필터링 · 차단 리스트 (차단한 후원자 4명 · 검색 · 해제) | `/creator/donations?tab=filtering&sub=block` | `322:10679` |
| 후원 관리 | T03g | 내역 이관 · 가져오기 (DEFAULT · FlexTV 연동 안 됨 · 가져온 기록 EMPTY, 2026-10-17) | `/creator/donations?tab=import` | `353:11108` |
| 후원 관리 | T03h | 내역 이관 · 투네이션 CSV 미리보기 (열 찾음 · 가져올 3건 · 오류 1 · 중복 1) | `/creator/donations?tab=import` | `353:11299` |
| 후원 관리 | T03i | 내역 이관 · CSV 미리보기 (열을 못 찾음 · 직접 고르기 · 파일 앞부분) | `/creator/donations?tab=import` | `354:11326` |
| 후원 관리 | T03j | 내역 이관 · CSV 오류 (엑셀 파일 안내 줄) | `/creator/donations?tab=import` | `354:11584` |
| 후원 관리 | T03k | 내역 이관 · 가져오는 중 (PROCESSING) | `/creator/donations?tab=import` | `355:11544` |
| 후원 관리 | T03l | 내역 이관 · 가져오기 완료 (SUCCESS · 타일 합계 · 가져온 기록 1줄) | `/creator/donations?tab=import` | `355:11903` |
| 후원 관리 | T03m | 내역 이관 · FlexTV 계정 연동됨 (아직 가져온 적 없음) | `/creator/donations?tab=import` | `356:11762` |
| 후원 관리 | T03n | 내역 이관 · FlexTV 내역 가져옴 (45건 새로 가져옴 · 기록 2줄) | `/creator/donations?tab=import` | `356:11967` |
| 후원 관리 | T03o | 내역 이관 · FlexTV 가져오기 실패 (연결 실패 · 다시 시도) | `/creator/donations?tab=import` | `356:12190` |
| 후원 관리 | T03p | 내역 이관 · 되돌리기 확인 팝업 (FlexTV 45건) | `/creator/donations?tab=import` | `357:12071` |
| 후원 관리 | T03q | 내역 이관 · 가져온 내역 (출처 · 기간 · 검색 · CSV 다운로드, 48건) | `/creator/donations?tab=import&sub=records` | `357:12306` |
| 후원 관리 | T03r | 내역 이관 · 가져온 내역 (EMPTY) | `/creator/donations?tab=import&sub=records` | `358:12280` |
| 후원 관리 | T03s | 받은 후원 · 퀘스트 후원 (진행 중 줄의 마감 · "연장됨 +10분", 앞 4줄 — 2026-10-18) | `/creator/donations?tab=list` | `370:13262` |
| 후원 관리 | T03d | 받은 후원 · 게임 후원 (룰렛 · 뽑기) | `/creator/donations?tab=list&kind=game` | `142:4530` |
| 후원 관리 | T03e | 받은 후원 · 크루 후원 (멤버 지정) | `/creator/donations?tab=list&kind=crew` | `143:4635` |
| 정산 | T04 | 정산 현황 + 체크리스트 | `/creator/settlement` | `68:3459` |
| 정산 | T04b | 정산 인증·등록 (이용동의) | `/creator/settlement/register` | `68:3655` |
| 정산 | T04c | 정산 자료 등록 | `/creator/settlement/register/form` | `69:3359` |
| 정산 | T04f | 정산 현황 (등록 완료) | `/creator/settlement` | `93:3479` |
| 정산 | T04d | 정산 신청 | `/creator/settlement/apply` | `93:3673` |
| 정산 | T04g | 정산 신청 팝업 (금액 입력) | `/creator/settlement/apply` | `94:7168` |
| 정산 | T04h | 정산 신청 전 본인인증 안내 (2026-10-06 결정, code-first) | `/creator/settlement?gate=identity` | `222:15931` |
| 정산 | T04e | 정산 관리 (연별) | `/creator/settlement/manage` | `93:3899` |

정산 신청 · 정산 관리는 정산 등록을 마친 상태에서만 열려요. 주민등록번호 · 계좌번호를 입력하지 않으려고, 로컬 mock에 표시용 등록 정보(예시은행 · 마스킹된 계좌 ********1234)만 넣고 읽었어요.

## 레이아웃 (10 레이아웃 · 사이트)

섹션은 사이드 메뉴 묶음 순서예요. 스튜디오와 같은 방식으로 만든 편집 가능한 프레임이고, 헤더(로그인 · 게스트) · 사이드 메뉴 · 푸터는
8 페이지의 컴포넌트 인스턴스예요. 사이드 메뉴는 화면마다 해당 메뉴를 강조해요. 방송 방 후원 패널은 패널만(418px) 그렸어요.
화면 속 이름 · 숫자 · 확률 · 금액은 코드의 목업 값이에요.

| 섹션 | ID | 화면 | 라우트 | 노드 |
|---|---|---|---|---|
| 홈 | S01 | 홈 | `/` | `74:3` |
| 홈 | S02 | 홈 — 라이트 테마 (Light 모드) | `/` | `89:6306` |
| 홈 | S00 | 홈 진입 팝업 (공지) | `/` | `94:6894` |
| 홈 | S13 | 404 · 사이트 헤더 · 메뉴 유지 (없는 글 · 채널 등 notFound(), code-first) | `/community/p-999` | `312:16403` |
| 홈 | S13b | 공통 오류 · 사이트 헤더 · 메뉴 유지 ("페이지를 불러오지 못했어요" · 다시 시도 — S13 복제 후 수정, code-first) | `/community` | `312:32383` |
| 홈 | S13c | 404 · 단독 (헤더 · 메뉴 없는 없는 주소, code-first) | `/no-such-page` | `312:16617` |
| 라이트 테마 | LT01 | 크리에이터 찾기 — 라이트 테마 | `/creators` | `338:22141` |
| 라이트 테마 | LT02 | 전체 방송 — 라이트 테마 | `/live` | `338:22433` |
| 라이트 테마 | LT03 | 채널 홈 — 라이트 테마 | `/creators/c1` | `338:22731` |
| 라이트 테마 | LT04 | 후원 패널 — 라이트 테마 | `/creators/c1?tab=donation` | `339:22727` |
| 라이트 테마 | LT05 | FN Wallet — 라이트 테마 | `/wallet` | `339:22800` |
| 라이트 테마 | LT06 | 충전 내역 — 라이트 테마 | `/wallet/charges` | `339:23195` |
| 라이트 테마 | LT07 | 후원 내역 — 라이트 테마 | `/wallet/donations` | `340:23117` |
| 라이트 테마 | LT08 | 마이페이지 — 라이트 테마 | `/mypage` | `340:23544` |
| 라이트 테마 | LT09 | 칭호·등급 — 라이트 테마 | `/mypage/titles` | `340:23894` |
| 라이트 테마 | LT10 | 알림 — 라이트 테마 | `/notifications` | `341:23708` |
| 라이트 테마 | LT11 | 커뮤니티 — 라이트 테마 | `/community` | `341:23936` |
| 라이트 테마 | LT12 | 이벤트 — 라이트 테마 | `/events` | `341:24181` |
| 라이트 테마 | LT13 | 명예의 전당 — 라이트 테마 | `/hall-of-fame` | `342:24291` |
| 라이트 테마 | LT14 | 플랫폼 후원 내역 — 라이트 테마 | `/donation/history` | `342:24622` |
| 라이트 테마 | LT15 | 로그인 — 라이트 테마 | `/login` | `342:24934` |
| 라이트 테마 | LT16 | 즐겨찾기 — 라이트 테마 | `/favorites` | `343:24708` |
| 라이트 테마 | LT17 | 쪽지 — 라이트 테마 | `/messages` | `343:24991` |
| 헤더 | S04 | 알림 | `/notifications` | `74:444` |
| 헤더 | S04b | 알림 · 확인 중 후원 결과 · 이벤트 보상 (💝 후원 "확인 중이던 후원이 실패했어요 · FN 반환" · 🎉 이벤트 "이벤트 보상 n FN을 받았어요", 2026-10-09 결정, code-first) | `/notifications` | `295:13841` |
| 헤더 | S04c | 알림 · 정산 결정 · 충전 환불 결정 · 퀘스트 시간 연장 (🧾 정산 "정산금이 지급됐어요" · "정산 신청이 승인됐어요" · "정산 신청이 거절됐어요", ↩️ 환불 "환불이 승인됐어요" · "환불 요청이 거절됐어요", 💝 후원 "퀘스트 제한 시간이 늘었어요", 2026-10-18, code-first) | `/notifications` | `375:27262` |
| 헤더 | S03 | 헤더 알림 팝오버 | `/` | `89:7290` |
| 탐색 | S05 | 크리에이터 찾기 | `/creators` | `74:646` |
| 탐색 | S06 | 전체 방송 | `/live` | `107:8173` |
| 탐색 | S06b | 인기 방송 | `/live/popular` | `107:8525` |
| 커뮤니티 · 이벤트 | S07 | 명예의 전당 (칭호 갤러리: 누적 블랙 · 누적 다이아 · 활동 등급 — 2026-10-08 등급 구조, 갤러리 `282:22836`만 다시 그림) | `/hall-of-fame` | `75:1117` |
| 커뮤니티 · 이벤트 | S08 | 커뮤니티 | `/community` | `75:1375` |
| 커뮤니티 · 이벤트 | S08b | 커뮤니티 글 상세 | `/community/p-1` | `75:1591` |
| 커뮤니티 · 이벤트 | S08c | 커뮤니티 · 검색 결과 없음 ("검색 결과가 없어요." · "다른 검색어로 찾아보세요.", code-first) | `/community?q=로봇청소기` | `239:11288` |
| 커뮤니티 · 이벤트 | S08d | 신고 팝업 · 커뮤니티 글 (사유 6종 · 상세 내용, 예시 입력) | `/community/p-1` | `320:21984` |
| 커뮤니티 · 이벤트 | S08e | 작성자 차단 확인 (브라우저 확인 창 window.confirm — 사이트 모달이 아니라 모양은 예시, S08d 복제 후 수정, code-first) | `/community/p-1` | `320:36739` |
| 커뮤니티 · 이벤트 | S09 | 커뮤니티 글쓰기 | `/community/new` | `76:1342` |
| 커뮤니티 · 이벤트 | S09b | 커뮤니티 글 수정 (작성자만) | `/community/[id]/edit` | `151:8418` |
| 커뮤니티 · 이벤트 | S10 | 이벤트 | `/events` | `76:1541` |
| 커뮤니티 · 이벤트 | S10b | 이벤트 상세 | `/events/ev-first-donation` | `76:1753` |
| 커뮤니티 · 이벤트 | S10c | 이벤트 상세 · 보상 참여자 전원 무상 FN (진행 중, 2026-10-08 결정, code-first) | `/events/ev-first-donation` | `291:12609` |
| 커뮤니티 · 이벤트 | S10d | 이벤트 상세 · 보상 추첨 N명 경품 (예정, code-first) | `/events/ev-crew-season` | `291:12825` |
| 커뮤니티 · 이벤트 | S10e | 이벤트 상세 · 보상 지급 완료 + "보상 1,000 FN을 받았어요" (종료, code-first) | `/events/ev-attendance` | `291:13042` |
| 커뮤니티 · 이벤트 | S10f | 이벤트 상세 · 당첨자 발표 (닉네임 가림 "홍*동") + "당첨됐어요" (종료, code-first) | `/events/ev-attendance` | `291:13260` |
| 커뮤니티 · 이벤트 | S10g | 이벤트 상세 · 탈퇴한 계정으로 참여해 보상 대상에서 빠짐 (재가입 후, 2026-10-09 결정, code-first) | `/events/ev-attendance` | `298:14488` |
| 커뮤니티 · 이벤트 | S10h | 이벤트 상세 · 당첨자 발표 + 미당첨 "아쉽지만 당첨되지 않았어요" (종료, code-first) | `/events/ev-attendance` | `299:14605` |
| 고객센터 | S11 | 고객센터 | `/support` | `76:1941` |
| 고객센터 | S11b | 고객센터 · 자주 묻는 질문 탭 (분류 칩 · 질문 18개) | `/support?tab=faq` | `312:15849` |
| 고객센터 | S11c | 고객센터 · 1:1 문의 탭 (연락처 · 문의하기 · 내 문의 내역 EMPTY) | `/support?tab=inquiry` | `312:16153` |
| 고객센터 | S12 | 공지 상세 | `/support/notices/brand` | `76:2163` |
| 크리에이터 채널 | C01 | 채널 홈 + 투표 카드(투표한 상태) · 월간 랭킹 · 커뮤니티 | `/creators/c1` | `161:8946` |
| 크리에이터 채널 | C01e | 채널 홈 · 즐겨찾기 요청 실패 토스트 ("즐겨찾기를 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.", 버튼 그대로 — 2026-10-18) | `/creators/c1` | `366:27100` |
| 크리에이터 채널 | C08 | 채널 홈 + 팬 메시지 · 요청사항 카드 (크루 방송 중 · 내가 보낸 글 "전달됨") | `/creators/c4` | `215:9524` |
| 크리에이터 채널 | C09 | 채널 홈 · 오프라인 방송 방 ("린토끼 님은 오프라인 상태입니다.") | `/creators/c7` | `312:16635` |
| 크리에이터 채널 | C02 | 크루 탭 | `/creators/c4` | `76:2695` |
| 크리에이터 채널 | C03 | 영상 탭 | `/creators/c1` | `77:2513` |
| 크리에이터 채널 | C04 | 커뮤니티 탭 | `/creators/c1` | `77:2803` |
| 크리에이터 채널 | C05 | 시그니처 탭 | `/creators/c1` | `77:3079` |
| 크리에이터 채널 | C06 | 소개 탭 | `/creators/c1` | `77:3353` |
| 크리에이터 채널 | C07 | 내 채널 만들기 (주소 확인 완료 · 예시 입력값, 코드로 그린 레이아웃 — 크리에이터 계정은 이 화면이 열리지 않음) | `/channel/new` | `151:8173` |
| 크리에이터 채널 | C07b | 스튜디오 권한 없음 ("크리에이터 권한이 필요합니다" → 내 채널 만들기 · 홈으로 가기, 채널 없는 회원 — 화면 구조를 페이지에 넣어 그림, code-first) | `/creator` | `320:21333` |
| 방송 방 후원 패널 | D-TEXT | 일반 | `/creators/c1?tab=donation` | `199:9524` |
| 방송 방 후원 패널 | D-MINI | 미니 | `/creators/c1?tab=donation` | `78:3182` |
| 방송 방 후원 패널 | D-VIDEO | 영상 (URL 입력만) | `/creators/c1?tab=donation` | `199:9597` |
| 방송 방 후원 패널 | D-AUDIO | 음성 (YouTube 소리만 · 미리보기 · 시작/종료 · 약관 동의 전, 2026-10-08) | `/creators/c1?tab=donation` | `284:12262` |
| 방송 방 후원 패널 | D-SIGNATURE | 시그니처 | `/creators/c1?tab=donation` | `78:3330` |
| 방송 방 후원 패널 | D-WISHLIST | 위시 | `/creators/c1?tab=donation` | `78:3398` |
| 방송 방 후원 패널 | D-ROULETTE | 룰렛 (크리에이터 항목 · 확률, 내 룰렛) | `/creators/c1?tab=donation` | `164:8940` |
| 방송 방 후원 패널 | D-ROULETTE-empty | 룰렛 · 내 룰렛 EMPTY ("참여한 룰렛이 없어요", 참여 기록 없는 채널, code-first) | `/creators/c2?tab=donation` | `312:15591` |
| 방송 방 후원 패널 | D-ROULETTE-error | 룰렛 · 내 룰렛 ERROR ("룰렛을 불러오지 못했어요." · 다시 시도 — 요청 실패로 재현, code-first) | `/creators/c2?tab=donation` | `312:15674` |
| 방송 방 후원 패널 | D-GACHA | 뽑기 (확률 · 상품 안내 동의, 내 뽑기) | `/creators/c1?tab=donation` | `166:8940` |
| 방송 방 후원 패널 | D-GACHA-empty | 뽑기 · 내 뽑기 EMPTY ("참여한 뽑기가 없어요", code-first) | `/creators/c2?tab=donation` | `312:15751` |
| 방송 방 후원 패널 | D-GACHA-error | 뽑기 · 내 뽑기 ERROR ("뽑기를 불러오지 못했어요." · 다시 시도 — 요청 실패로 재현, code-first) | `/creators/c2?tab=donation` | `312:15800` |
| 방송 방 후원 패널 | D-QUEST | 퀘스트 (실패 · 취소 시 전액 환불) | `/creators/c1?tab=donation` | `158:8946` |
| 방송 방 후원 패널 | D-DRAWING | 그림 | `/creators/c1?tab=donation` | `79:3259` |
| 방송 방 후원 패널 | D-crew-member | 크루 멤버 지정 | `/creators/c4?tab=donation` | `79:3580` |
| 방송 방 후원 패널 | D-confirm | 후원하기 확인 + 후원 알림 미리보기 (613:6 + code-first; 배지 플래티넘 · 새싹 팬, 2026-10-08) | `/creators/c1?tab=donation` | `112:8173` |
| 방송 방 후원 패널 | D-confirm-word | 후원하기 확인 · 금지어 오류 ("사용할 수 없는 단어가 포함되어 있어요.", code-first) | `/creators/c1?tab=donation` | `310:15189` |
| 방송 방 후원 패널 | D-confirm-price | 후원하기 확인 · 가격 변경 오류 (시그니처, "크리에이터가 가격을 바꿨어요. 지금 가격은 N FN이에요…" — D-confirm-word 복제 후 문구 수정, code-first) | `/creators/c1?tab=donation` | `310:30352` |
| 방송 방 후원 패널 | D-nickname-select | 일반 후원 · 별명 선택 (별명 2개 이상일 때만 보임, 예시 별명 "응원단장") | `/creators/c1?tab=donation` | `320:21255` |
| 방송 방 후원 패널 | D-CHAT-emoji | 채팅 · 이모지 고르기 (6×4, 커서 위치에 넣기 · 여러 개 연속, code-first) | `/creators/c1` | `197:9523` |
| 플랫폼 후원 | P01 | SOOP 후원 | `/donation/soop` | `80:3182` |
| 플랫폼 후원 | P02 | FlexTV 후원 | `/donation/flextv` | `80:3424` |
| 플랫폼 후원 | P03 | 플랫폼 크리에이터 검색 | `/donation/soop/search` | `80:3665` |
| 플랫폼 후원 | P04 | 플랫폼 크리에이터 후원 | `/donation/soop/kim_stream` | `80:3859` |
| 플랫폼 후원 | P04d | 플랫폼 크리에이터 후원 · 후원 실패 (연결 오류 · "FN은 차감되지 않았습니다", 펀페이 817:9618 상태) | `/donation/soop/gameking` | `297:13829` |
| 플랫폼 후원 | P04e | 플랫폼 크리에이터 후원 · 결과 확인 뒤 실패 (「결과 다시 확인」 → "보류된 FN은 반환되었습니다", 2026-10-09, code-first) | `/donation/soop/kim_stream` | `297:14051` |
| 플랫폼 후원 | P04f | 플랫폼 크리에이터 후원 · 상품 단계 요청 실패 (오류 줄 · 고른 상품 유지 · 다시 누를 수 있음 — 2026-10-18) | `/donation/soop/kim_stream` | `366:26849` |
| 플랫폼 후원 | P05 | 플랫폼 후원 내역 | `/donation/history` | `199:9683` |
| 플랫폼 후원 | P05b | 플랫폼 후원 내역 · 거래 상세 처리중 ("처리 결과 확인 중 · … FN은 보류돼요", 2026-10-08 결정, code-first) | `/donation/history?tx=TXN-SEED-B12` | `291:12262` |
| 마이 | M01 | 마이페이지 (랭킹 노출: 퀘스트; 활동 등급 카드 — M01b · M01c도 같은 카드, 2026-10-08) | `/mypage` | `81:4024` |
| 마이 | M01b | 마이페이지 · 비밀번호 변경 5회 실패 잠금 (로그인과 같은 횟수, 닫기 · 비밀번호 재설정, code-first) | `/mypage` | `235:10701` |
| 마이 | M01c | 마이페이지 · 썸네이션 ID 보호 중 (바꾼 ID 30일 보호 — 2026-10-08 결정, 스튜디오 프로필 수정 창도 같은 문구, code-first) | `/mypage` | `235:11086` |
| 마이 | M01d | 프로필 사진 변경 팝업 | `/mypage` | `315:16961` |
| 마이 | M01e | 프로필 사진 변경 · 지원하지 않는 파일 형식 (GIF) | `/mypage` | `315:17512` |
| 마이 | M01f | 닉네임 수정 팝업 | `/mypage` | `315:18058` |
| 마이 | M01g | 닉네임 수정 · 사용할 수 없는 표현 ("운영자" 중복 확인) | `/mypage` | `315:18608` |
| 마이 | M01h | 썸네이션 ID 수정 팝업 | `/mypage` | `315:19156` |
| 마이 | M01i | 썸네이션 ID 수정 · 형식 오류 ("abc") | `/mypage` | `315:19707` |
| 마이 | M01j | 비밀번호 변경 팝업 | `/mypage` | `315:20262` |
| 마이 | M01k | 비밀번호 변경 · 현재 비밀번호 불일치 | `/mypage` | `315:20822` |
| 마이 | M01l | 로그인 연동 · 네이버 연결 관리 팝업 | `/mypage` | `315:21374` |
| 마이 | M01m | 로그인 연동 · 네이버 연결 오류 ("일시적인 오류가 발생했습니다…" — 요청 실패로 재현) | `/mypage` | `315:21927` |
| 마이 | M01n | 연결 플랫폼 · FLEX TV 계정 연결 팝업 | `/mypage` | `315:22478` |
| 마이 | M01o | 연결 플랫폼 · FLEX TV 계정 ID 확인 오류 | `/mypage` | `315:23030` |
| 마이 | M01p | 본인인증 팝업 (휴대폰 · 아이핀) | `/mypage` | `315:23586` |
| 마이 | M01q | 본인인증 팝업 · 오류 줄 ("일시적인 오류가 발생했습니다…", 2026-10-17) | `/mypage` | `360:25288` |
| 마이 | M01r | 본인인증 결과 · 완료 (인증자 · 완료 일시 · 마이페이지로 돌아가기) | `/mypage` | `360:25850` |
| 마이 | M01s | 본인인증 결과 · 이미 완료된 계정 (인증자 · 생년월일 · 완료 일시) | `/mypage` | `360:26415` |
| 마이 | M01t | 본인인증 결과 · 동일 명의 계정 있음 (가린 ID · 가입일 예시 값, 로그인으로 돌아가기 · 내 계정 찾기) | `/mypage` | `360:26980` |
| 마이 | M01u | 본인인증 결과 · 시도 횟수 초과 (제한 해제 시각 예시 값, 고객센터 안내 · 확인) | `/mypage` | `360:27542` |
| 마이 | M02 | 칭호·등급 (활동 등급 6개월 · 누적 등급 다이아 · 블랙 두 줄, 2026-10-08 등급 구조 · 익명 후원은 크리에이터 칭호 제외 안내 2026-10-09) | `/mypage/titles` | `296:14060` |
| 마이 | M03 | 별명 관리 (별명 누적 후원 · 별명 후원 횟수, 익명 후원 제외 안내, 2026-10-09) | `/mypage/nicknames` | `296:13829` |
| 마이 | M04 | 내 후원 랭킹 (안내: 익명 후원 집계 제외 2026-10-08) | `/mypage/ranking` | `82:4528` |
| 마이 | M06 | 쪽지 | `/messages` | `199:9995` |
| 마이 | M06b | 쪽지 보내기 팝업 (받는 사람 · 내용, 예시 입력) | `/messages` | `312:16986` |
| 마이 | M06c | 쪽지 · 보관함 (받은 쪽지함으로 · 스팸신고 · 삭제) | `/messages?box=archive` | `320:21510` |
| 마이 | M06d | 쪽지 · 스팸함 (보관 · 받은 쪽지함으로 · 삭제) | `/messages?box=spam` | `320:21747` |
| 마이 | M07 | 즐겨찾기 | `/favorites` | `82:5066` |
| 마이 | M09 | 출석체크 (15일 · 30일 보상 "달성 시 자동 지급" 2026-10-08) | `/attendance` | `82:5322` |
| 마이 | M10 | 차단 관리 (차단한 사용자 2명) | `/mypage/blocks` | `151:8644` |
| 마이 | M10b | 차단 관리 · 비어 있음 | `/mypage/blocks` | `151:8861` |
| 마이 | M11 | 회원 탈퇴 (크리에이터 · 남은 FN · 정산 대기 수익 소멸 동의, 비밀번호 확인) | `/mypage/withdraw` | `182:9521` |
| 마이 | M11b | 회원 탈퇴 · 비밀번호 불일치 | `/mypage/withdraw` | `182:9765` |
| 마이 | M11c | 회원 탈퇴 · 완료 | `/mypage/withdraw` | `182:10010` |
| 마이 | M11d | 회원 탈퇴 · 처리 중인 충전 환불 (탈퇴 불가, 2026-10-06 결정) | `/mypage/withdraw` | `221:224` |
| 마이 | M11e | 회원 탈퇴 · 비밀번호 5회 실패 잠금 (로그인과 같은 횟수, 세션 종료, code-first) | `/mypage/withdraw` | `236:17427` |
| 마이 | M11f | 회원 탈퇴 · 진행 중인 퀘스트 + 탈퇴 후 보관 정보 + \"승인된 정산은 그대로 지급돼요\" (2026-10-08, code-first) | `/mypage/withdraw` | `285:12262` |
| 마이 | M11g | 회원 탈퇴 · 보낸 퀘스트 후원 진행 중 (후원자 카드 변형, code-first) | `/mypage/withdraw` | `241:17964` |
| 마이 | M11h | 회원 탈퇴 · 처리 결과 확인 중인 플랫폼 후원 (탈퇴 불가 카드, 진행 중 퀘스트와 함께, 2026-10-09 결정, code-first) | `/mypage/withdraw` | `295:13239` |
| 마이 | M11i | 회원 탈퇴 · 처리 중인 충전 (탈퇴 불가 카드 "처리 중인 충전 n건", 2026-10-10 결정, code-first) | `/mypage/withdraw` | `305:2` |
| FN 지갑 | M05 | FN Wallet (유형 칩 "전체 유형 · 충전 · 사용 · 환불 · FN 반환 · 적립", 2026-10-09) | `/wallet` | `298:14706` |
| FN 지갑 | M05k | FN Wallet · 유형 "FN 반환" (실패한 플랫폼 후원으로 돌려받은 FN, 2026-10-09 결정, code-first) | `/wallet?kind=RETURN` | `298:14217` |
| FN 지갑 | M05b | FN 충전 (모달) | `/wallet` | `85:5369` |
| FN 지갑 | M05u | FN 충전 · 서비스 이용약관 동의 시트 (처음 열 때, [필수] 3 · [선택] 1) | `/wallet` | `317:20673` |
| FN 지갑 | M05v | FN 충전 · 결제수단변경 (썸네이션 Pay · 결제 수단 타일 · 선택 완료) | `/wallet` | `317:21477` |
| FN 지갑 | M05w | FN 충전 · 완료 ("결제가 정상적으로 완료되었습니다.", 목업 결제) | `/wallet` | `317:22160` |
| FN 지갑 | M05c | 충전 내역 (처리 상태 "결제 취소" 라벨, 2026-10-13) | `/wallet/charges` | `307:14994` |
| FN 지갑 | M05l | 충전 내역 상세 · "결제 확인 일시" (처리중이던 충전을 나중에 결제 확인, 2026-10-13, code-first) | `/wallet/charges` | `307:15407` |
| FN 지갑 | M05d | 후원 내역 | `/wallet/donations` | `87:5705` |
| FN 지갑 | M05m | 후원 내역 · 퀘스트 후원 탭 (완료 · 처리중) | `/wallet/donations?type=quest` | `310:15222` |
| FN 지갑 | M05n | 후원 내역 · 게임 후원 탭 (룰렛 · 뽑기) | `/wallet/donations?type=game` | `310:15535` |
| FN 지갑 | M05e | 충전 내역 상세 · 환불 요청 입력 — 수수료 공제 후 환불 계산 · 환불 금액(원) · 환불 정책 요약 (기본값, 2026-10-08, code-first) · 처리중이던 충전은 결제 확인일부터 7일 (2026-10-13) | `/wallet/charges` | `292:13239` |
| FN 지갑 | M05t | 충전 내역 상세 · 환불 요청 — 전액 취소 (7일 이내 · 미사용, 환불 수수료 없음 · 결제 취소 금액, 기본값, code-first) | `/wallet/charges` | `316:21361` |
| FN 지갑 | M05o | 충전 내역 상세 · 환불 금액 계산 중 (LOADING "환불 금액을 계산하고 있어요…" — 응답 지연으로 재현, code-first) | `/wallet/charges` | `316:19497` |
| FN 지갑 | M05p | 충전 내역 상세 · 환불 금액 불러오기 실패 ("환불 금액을 불러오지 못했어요…" · 다시 시도 — 요청 실패로 재현, code-first) | `/wallet/charges` | `316:20106` |
| FN 지갑 | M05q | 충전 내역 상세 · 환불 요청 실패 ("요청하지 못했어요…" — 요청 실패로 재현, code-first) | `/wallet/charges` | `316:20736` |
| FN 지갑 | M05r | 충전 내역 상세 · 그 사이 FN 사용으로 내용 바뀜 ("그 사이 FN을 사용해…", 새 계산 예시 — M05q 복제 후 수정, code-first) | `/wallet/charges` | `316:36249` |
| FN 지갑 | M05s | 충전 내역 상세 · 그 사이 FN 반환으로 내용 바뀜 ("그 사이 FN이 돌아와…", 새 계산 예시 — M05q 복제 후 수정, 2026-10-09 결정, code-first) | `/wallet/charges` | `316:36669` |
| FN 지갑 | M05i | 충전 내역 상세 · 환불 불가 (충전 FN 모두 사용, "닫기"만, code-first) | `/wallet/charges` | `259:22796` |
| FN 지갑 | M05j | 후원 내역 · 실패한 플랫폼 후원 "FN 반환" (2026-10-09 결정, code-first) | `/wallet/donations` (2쪽) | `295:13541` |
| FN 지갑 | M05f | 충전 내역 상세 · 환불 요청 접수 (심사 중, 목록 "환불 요청" 태그) | `/wallet/charges` | `228:10726` |
| FN 지갑 | M05h | 충전 내역 상세 · 환불 승인 (FN 회수, 목록 "환불 완료" 태그) | `/wallet/charges` | `228:11336` |
| FN 지갑 | M05g | FN Wallet · 충전 환불 행 (승인 후 −FN) | `/wallet` | `228:17870` |
| 인증 | A01 | 로그인 | `/login` | `88:5879` |
| 인증 | A01b | 로그인 · 이용 정지 계정 ("운영 정책에 따라 이용이 정지된 계정입니다…" — 오류 줄 문구 교체, code-first) | `/login` | `320:21375` |
| 인증 | A01c | 로그인 · 5회 실패 잠금 ("로그인이 제한되었습니다" → 비밀번호 재설정으로 이동 — 화면 구조를 페이지에 넣어 그림, code-first) | `/login` | `320:21437` |
| 인증 | A02 | 로그인 (크리에이터) | `/login?role=creator` | `89:6882` |
| 인증 | A03 | 회원가입 | `/signup` | `88:5941` |
| 인증 | A03b | 회원가입 · 2단계 휴대폰 번호 인증 | `/signup` | `314:16767` |
| 인증 | A03c | 회원가입 · 2단계 휴대폰 인증 완료 (예시 번호) | `/signup` | `314:16837` |
| 인증 | A03f | 회원가입 · 2단계 인증 만료 안내 ("인증이 만료되었어요…", code-first) | `/signup` | `314:16895` |
| 인증 | A03d | 회원가입 · 3단계 계정 설정 (중복 확인 완료, 예시 입력) | `/signup` | `314:16966` |
| 인증 | A03g | 회원가입 · 3단계 중복 확인 요청 실패 (칸 아래 오류 · 버튼 다시 누를 수 있음 — 2026-10-18) | `/signup` | `366:50677` |
| 인증 | A03e | 회원가입 · 완료 ("회원가입을 축하합니다!") | `/signup` | `314:17051` |
| 인증 | A04 | 비밀번호 재설정 | `/password-reset` | `88:6027` |
| 인증 | A04b | 비밀번호 찾기 · 재설정 이메일 보냄 | `/password-reset` | `314:17110` |
| 인증 | A04c | 비밀번호 찾기 · 휴대폰 번호로 인증 | `/password-reset` | `314:17151` |
| 인증 | A04f | 비밀번호 찾기 · 휴대폰 인증 만료 안내 ("인증이 만료되었어요…", code-first) | `/password-reset` | `314:17205` |
| 인증 | A04d | 비밀번호 재설정 · 새 비밀번호 입력 (휴대폰 인증 후) | `/password-reset` | `314:17260` |
| 인증 | A04e | 비밀번호 재설정 · 완료 ("비밀번호가 변경되었습니다" — 화면 구조를 페이지에 넣어 그림, code-first) | `/password-reset` | `320:21475` |
| 인증 | A05 | 비밀번호 변경 | `/login/password-change` | `88:6072` |
| 인증 | A06 | 홈 (비로그인, 게스트 헤더) | `/` | `89:6579` |
| 약관 | L01 | 서비스 이용약관 (초안 본문 · 초안 배너 · 문서 탭 7개, 앞 6개 조항만 — 2026-10-08) | `/terms/service` | `260:12262` |
| 약관 | L02 | 개인정보 처리 방침 (초안 본문 — 처리 항목 · 목적 · 보유 기간 표, 앞 3개 항목만 — 2026-10-08) | `/terms/privacy` | `261:15996` |
| 약관 | L03 | FN 충전 · 환불 정책 (초안 · 기본값, 앞 6개 항목만 — 2026-10-08, code-first) | `/terms/refund` | `259:23183` |
| 약관 | L02m | 개인정보 처리 방침 · 모바일 375 (표는 가로 스크롤 · 문서 탭은 줄바꿈, 앞 3개 항목, 헤더 · 푸터 생략 — 2026-10-17) | `/terms/privacy` | `364:26849` |
| 약관 | L04 | 청소년 보호정책 (초안, 5개 조항 전체 — 2026-10-17) | `/terms/youth` | `362:26073` |
| 약관 | L05 | 운영정책 (초안, 앞 6개 조항만 — 2026-10-17) | `/terms/operation` | `362:26343` |
| 약관 | L06 | 광고성 정보 수신 및 마케팅 활용 동의 (초안, 5개 항목 전체 — 2026-10-17) | `/terms/marketing` | `363:26461` |
| 약관 | L07 | 크리에이터 이용약관 (초안, 앞 6개 조항만 — 2026-10-17) | `/terms/creator` | `363:26733` |
| OBS 오버레이 | O02 | 후원 알림 (800×600) | `/overlay/alert/[key]` | `92:6819` |
| OBS 오버레이 | O02b | 후원 알림 · 등급·칭호 배지 (실제 후원; 플래티넘 + 크리에이터 칭호, 목업 회원은 누적 등급 없음) | `/overlay/alert/[key]` | `112:8207` |
| OBS 오버레이 | O02-off | 후원 알림 · 기능 제어 OFF (800×600) | `/overlay/alert/[key]` | `133:25` |
| OBS 오버레이 | O03 | 이펙트 · 효과 (1920×1080) — 파티클 위치는 예시 배치 | `/overlay/effects/[key]` | `92:6828` |
| OBS 오버레이 | O03-off | 이펙트 · 효과 · 기능 제어 OFF (1920×1080) | `/overlay/effects/[key]` | `133:34` |
| OBS 오버레이 | O04 | 영상 후원 (1280×720) — YouTube 임베드 자리 | `/overlay/video/[key]` | `92:6849` |
| OBS 오버레이 | O04-off | 영상 후원 · 기능 제어 OFF (1280×720) | `/overlay/video/[key]` | `133:56` |
| OBS 오버레이 | O05 | 그림후원 (800×700) | `/overlay/drawing/[key]` | `92:6856` |
| OBS 오버레이 | O05-off | 그림 후원 · 기능 제어 OFF (800×700) | `/overlay/drawing/[key]` | `133:64` |
| OBS 오버레이 | O06 | 크루 점수판 (480×600) | `/overlay/crew/[key]` | `92:6866` |
| OBS 오버레이 | O06b | 실시간 배틀 (480×600) | `/overlay/crew/[key]?battle` | `119:8173` |
| OBS 오버레이 | O06c | 기여도 강탈 (480×600) | `/overlay/crew/[key]?steal` | `119:8191` |
| OBS 오버레이 | O06d | 콘텐츠 시나리오 (480×600) | `/overlay/crew/[key]?scenario` | `119:8199` |
| OBS 오버레이 | O06e | 서브 점수판 (480×600, 진행 중 판 · 오버레이 테마 미니멀 필) | `/overlay/crew/[key]?board=2` | `322:33170` |
| OBS 오버레이 | O06f | 서브 점수판 · 마감 (480×600, 마감 표시 · 구간 TOP 3) | `/overlay/crew/[key]?board=1` | `322:33195` |
| OBS 오버레이 | O06-off | 크루 점수판 · 배틀 · 강탈 · 시나리오 · 기능 제어 OFF (480×600) | `/overlay/crew/[key]` | `133:2` |
| OBS 오버레이 | O07 | 배너 (1920×1080) | `/overlay/banner/[key]` | `92:6888` |
| OBS 오버레이 | O07-off | 배너 · 기능 제어 OFF (1920×1080) | `/overlay/banner/[key]` | `133:75` |
| OBS 오버레이 | O08 | 자막 (1920×200) | `/overlay/tool/subtitle/[key]` | `92:6894` |
| OBS 오버레이 | O08-off | 자막 · 기능 제어 OFF (1920×200) | `/overlay/tool/subtitle/[key]` | `133:82` |
| OBS 오버레이 | O09 | 전광판 (1920×100) | `/overlay/tool/marquee/[key]` | `92:6900` |
| OBS 오버레이 | O09-off | 전광판 · 기능 제어 OFF (1920×100) | `/overlay/tool/marquee/[key]` | `133:89` |
| OBS 오버레이 | O10 | 타이머 (600×200) | `/overlay/tool/timer/[key]` | `92:6906` |
| OBS 오버레이 | O10-off | 타이머 · 기능 제어 OFF (600×200) | `/overlay/tool/timer/[key]` | `133:96` |
| OBS 오버레이 | O11 | 엔딩 크레딧 (1920×1080, 흐르는 중) | `/overlay/tool/credits/[key]` | `92:6912` |
| OBS 오버레이 | O11-off | 엔딩 크레딧 · 기능 제어 OFF (1920×1080) | `/overlay/tool/credits/[key]` | `133:103` |
| OBS 오버레이 | O12 | 후원목표 (800×200, 산정 기간 9월 · 목업 후원 이력) | `/overlay/widget/goal/[key]` | `146:8173` |
| OBS 오버레이 | O13 | 후원누적금액 (600×120) | `/overlay/widget/total/[key]` | `146:8186` |
| OBS 오버레이 | O14 | 후원랭킹 (400×500, 심플 · 월간) | `/overlay/widget/ranking/[key]` | `146:8193` |
| OBS 오버레이 | O15 | 최근알림 (800×200, 최근 3건) | `/overlay/widget/recent/[key]` | `146:8203` |
| OBS 오버레이 | O16 | 이벤트 (500×600, 박스형 · 새 후원 직후, 15초 뒤 자동 숨김) | `/overlay/widget/event/[key]` | `146:8217` |
| OBS 오버레이 | O17 | 후원 QR코드 (300×360, 캡션 위 · QR 이미지는 자리표시) | `/overlay/widget/qr/[key]` | `146:8231` |
| OBS 오버레이 | O12-off | 후원 위젯 · 기능 제어 OFF (6종 공통, 아무것도 표시 안 함) | `/overlay/widget/[widget]/[key]` | `146:8241` |
| OBS 오버레이 | O18 | 퀘스트 (600×400, 화려한 · 진행 중 2건, 남은 시간 · 상금) | `/overlay/widget/quest/[key]` | `154:14403` |
| OBS 오버레이 | O18b | 퀘스트 (600×400, 화려한 · 연장된 퀘스트에 "연장됨 +10분" 칩 — 2026-10-18) | `/overlay/widget/quest/[key]` | `372:27262` |
| OBS 오버레이 | O19 | 투표 (600×500, 진행 중 · 표 수는 예시) | `/overlay/widget/vote/[key]` | `161:9339` |
| OBS 오버레이 | O20 | 룰렛 (640×360, 회전 중) | `/overlay/widget/roulette/[key]` | `164:9017` |
| OBS 오버레이 | O20b | 룰렛 (640×360, 결과 공개) | `/overlay/widget/roulette/[key]` | `164:9032` |
| OBS 오버레이 | O20c | 룰렛 (640×360, 결과 공개 대기 — 결과 자동 노출 OFF) | `/overlay/widget/roulette/[key]` | `173:5415` |
| OBS 오버레이 | O21 | 뽑기 (640×400, 뽑는 중 · 캡슐, 코드 구조대로 그린 예시) | `/overlay/widget/gacha/[key]` | `166:8981` |
| OBS 오버레이 | O21b | 뽑기 (640×400, 당첨 공개) | `/overlay/widget/gacha/[key]` | `166:8992` |
| OBS 오버레이 | O22 | 뽑기 당첨 리스트 (800×120, 전광판) | `/overlay/widget/gacha-board/[key]` | `166:9003` |
| OBS 오버레이 | O23 | 벽지 (1920×1080, 자동 배치 스티커 벽 · 기본형, 이미지는 자리표시) | `/overlay/widget/wallpaper/[key]` | `175:8939` |
| OBS 오버레이 | O24 | 빙고 (600×700, 3 × 3 · 1줄 완성 · 빙고!) | `/overlay/tool/bingo/[key]` | `215:9924` |

OBS 오버레이는 투명 배경이라 회색 바탕 위에 그렸어요. 테스트 후원 · 테스트 그림 · 방송 도구 켜기 · 크루 방송 시작으로 띄운 상태를 읽었고, 이펙트(무작위 파티클)와 영상(외부 임베드)은 코드 구조대로 그린 예시 배치예요. 통합 채팅 오버레이는 9 페이지(O04 `49:504`)에 있어요. 아이콘은 회색 자리표시 사각형이에요.

## 레이아웃 (11 레이아웃 · 오버레이 테마)

오버레이 테마(2026-10-08, `docs/research/flextv-livehelper.md`)를 테마별로 그린 페이지예요. 세 섹션이 같은 프레임 구성을 보여 주고, 섹션마다
Overlay Theme 모드가 고정돼 있어요. 프레임 크기는 오버레이 주소 목록의 OBS 권장 크기이고, 오버레이는 모두 8 페이지 Overlay Theme 섹션
(`249:165`)의 인스턴스예요. 프레임 배경 그라데이션은 방송 화면 예시(OBS 소스는 투명), 닉네임 · 금액은 가상 예시예요.

| 섹션 | 노드 | 프레임 |
|---|---|---|
| 볼드 플랫 | `258:334` | 47개 — 아래 목록 |
| 미니멀 필 (기본) | `258:1668` | 47개 |
| 소프트 글래스 | `258:2775` | 47개 |
| 스튜디오 · 오버레이 테마 | `261:3616` | W00 위젯 페이지 위 "오버레이 테마" 카드 `261:3617`(Site 변수 · Dark, 미니멀 필 선택 · 사용 중, 테마 저장 비활성) + 상태 메모 + 이 페이지 쓰는 법 |

섹션마다 들어 있는 프레임: 후원 알림 카드형 · 가로 띠형 · 이미지 강조형(800 × 600), 통합 채팅 5종(400 × 600), 후원목표 막대 · 원형 · 반원 · 하트 · 별
(800 × 200, 글자 기본 14px), 후원누적금액(600 × 120), 후원랭킹(400 × 500), 최근알림(800 × 200), 미니후원 스크롤형 · 말풍선형(800 × 120, 2026-10-09), 이벤트 리스트형(500 × 600), 후원 QR코드(300 × 360),
퀘스트(600 × 400), 투표(600 × 500), 룰렛(640 × 360), 뽑기(640 × 400), 뽑기 당첨 리스트(800 × 120), 시계 플립 · 디지털 · 아날로그(600 × 240),
자막(1920 × 200), 전광판(1920 × 100), 타이머(600 × 200), 빙고(600 × 700), 엔딩 크레딧(1920 × 1080), 크루 점수판 · 실시간 배틀 · 콘텐츠 시나리오 ·
기여도 강탈(480 × 600), 영상 후원 · 음성 후원(1280 × 720), 그림 후원(800 × 700), 세로 방송: 후원 알림 3종(1080 × 640) · 통합 채팅(1080 × 900) ·
후원목표 막대 · 원형 · 하트(1080 × 520).

10 페이지의 OBS 오버레이 프레임(O02–O24)은 오버레이 테마 이전 모습이에요. 테마가 있는 오버레이의 지금 디자인은 이 페이지를 보세요.
이펙트 · 배너 · 벽지는 이미지와 효과만 그려서 테마가 없어요.

### 설정 팝업 (9 레이아웃 · 스튜디오 → "방송 · 위젯 · 설정 팝업 (오버레이 테마)" 섹션 `266:6596`)

오버레이 테마가 들어간 위젯 설정 팝업 14개예요(2026-10-08). 배경은 W12(위젯 목록 + 오버레이 테마 카드)이고, 팝업마다 그 화면을 복제해
어둡게(0.6) 깐 뒤 팝업을 얹었어요. 팝업 미리보기는 8 페이지 오버레이 컴포넌트 인스턴스(모드 = 미니멀 필, 채널 전체 테마)이고 코드처럼
오버레이 폭에 맞춰 줄이기만 해요(확대 안 함). 테마 칩 견본 · 알림 모양 · 목표 모양 그림은 위 컴포넌트, 스위치는 켜짐이면 오른쪽 + 체크 아이콘.
벽지 스티커 · 랭킹 스타일 썸네일은 `apps/web/public/mock/creator/widgets`의 목업 일러스트를 올렸어요. 미니후원(W12o, 2026-10-09)은 테마 · 배경 카드가 생겨 여기에 추가했고, 커스텀 사운드(W12p)는 테마는 없지만 재생 위치 안내를
담아 같은 섹션에 다시 그렸어요(예전 W01b는 라이브러리 고르기 상태).

## 레이아웃 (12 레이아웃 · 도우미)

Ssumnation 도우미(2026-10-14, `docs/development/helper-domain.md`) 화면이에요. 레거시 FlexTV 도우미처럼 왼쪽 메뉴(Helper Sidebar) + 맨 아래 리모컨 버튼이고,
컴포넌트는 8 페이지 "Helper (도우미)" 섹션(`326:501`)에 있어요. 위젯 기능 페이지의 설정 카드는 9 페이지 설정 팝업(W12a–W12p) 본문을 복제해서
미리보기가 Overlay Theme 인스턴스(미니멀 필)이고, 스튜디오와 같은 화면은 9 페이지 화면의 Main을 복제한 뒤 Helper Sidebar를 붙였어요.
오버레이 주소는 `https://{도우미 도메인}/…`(실제 도메인 TBD), 이름 · 숫자는 예시 값이에요. 페이지 맨 위 메모 `333:7039`.
다시 그릴 때는 shared plugin data `somnation/helperKit`(shell · pageHeader · tabsRow · saveBar · place · relayout)과 `somnation/helperRender`
(`scripts/figma/renderer.js`의 트리 렌더러)를 써요.

| 섹션 | ID | 화면 | 라우트 (도우미 도메인) | 노드 |
|---|---|---|---|---|
| 진입 · 계정 | HP00 | 랜딩 (로그인 전) | `/` | `332:5771` |
| 진입 · 계정 | HP01 | 채널 필요 (로그인 · 채널 없음, 다른 계정으로 로그인) | `/` | `332:5800` |
| 진입 · 계정 | HP02 | 로그인 (A01 + Helper Top Bar) | `/login` | `332:5818` |
| 진입 · 계정 | HP02b | 회원가입 완료 (간편 로그인 연동 버튼 없음) | `/signup` | `332:5883` |
| 진입 · 계정 | HP02c | 내 채널 만들기 (C07 + Helper Top Bar) | `/channel/new` | `332:6214` |
| 진입 · 계정 | HP04 | 도우미 404 (사이트 주소 · 없는 주소) | `/wallet` 등 | `332:6555` |
| 시작하기 | HP03 | 시작하기 (OBS 연결 순서 3단계 + 기능 카드) | `/` | `332:6223` |
| 방송 화면 | HP10 | 후원 알림 · 알림 디자인 (탭 3, 저장 바 Clean) | `/alert` | `327:13` |
| 방송 화면 | HP10b | 후원 알림 · 저장하지 않은 변경 (저장 바 Dirty) | `/alert` | `327:335` |
| 방송 화면 | HP10c | 후원 알림 · 커스텀 사운드 (항목마다 저장, 저장 바 없음) | `/alert?tab=sound` | `327:613` |
| 방송 화면 | HP10d | 후원 알림 · 미니 후원 | `/alert?tab=mini` | `327:803` |
| 방송 화면 | HP11 | 채팅창 | `/chat` | `327:1064` |
| 방송 화면 | HP12 | 통합 채팅 (C01 Main) | `/chat/manage` | `328:9522` |
| 방송 화면 | HP13 | 목표치 | `/goal` | `327:1346` |
| 방송 화면 | HP14 · HP14b · HP14c · HP14d | 후원 자막 · 후원 랭킹 · 누적 금액 · 최근 후원 · 이벤트 목록 (탭 4) | `/subtitles` (`?tab=total` · `recent` · `event`) | `327:1628` · `327:1969` · `327:2204` · `327:2455` |
| 방송 화면 | HP15 · HP16 | 시계 · QR 코드 | `/clock` · `/qr` | `327:2708` · `327:2931` |
| 방송 화면 | HP17 | 방송 도구 (W02b Main) | `/tools` | `328:9811` |
| 후원 콘텐츠 | HP20 · HP21 · HP22 · HP23 | 시그니처 · 영상 · 음성 후원 · 그림 후원 · 이펙트 (W06 · W07b · W08b · W05 Main) | `/signatures` · `/video` · `/drawing` · `/effects` | `328:10104` · `328:10319` · `328:10491` · `328:10685` |
| 후원 콘텐츠 | HP24 | 배너 (기능 제어 OFF 예시, W10 Main) | `/banner` | `328:10849` |
| 후원 콘텐츠 | HP25 | 벽지 | `/wallpaper` | `327:3181` |
| 게임센터 | HP30 · HP31 · HP32 · HP33 | 퀘스트 · 투표 · 룰렛 · 뽑기 | `/quest` · `/vote` · `/roulette` · `/gacha` | `327:3479` · `327:3795` · `327:4054` · `327:4315` |
| 크루 방송 | HP40 · HP41 | 크루 관리 · 방송 운영 (방송 전) (Y03 · Y04f Main) | `/crew` · `/crew/broadcast` | `328:11089` · `328:11277` |
| 연결 · 설정 | HP50 | 전체 테마 (11 페이지 오버레이 테마 카드) | `/theme` | `332:6691` |
| 연결 · 설정 | HP51 · HP51b | 오버레이 주소 · 미리보기 (W03c · W03b Main) | `/overlays` · `/overlays/preview/[id]` | `328:11801` · `328:11955` |
| 연결 · 설정 | HP52 · HP53 · HP54 | 이미지 · 사운드 · 후원 연동 · 유튜브 연동 (W09 · W11 · Y01 Main) | `/assets` · `/link` · `/youtube` | `328:12123` · `328:12354` · `328:12516` |
| 연결 · 설정 | HP55 | 후원 필터링 (T03c Main, 후원관리+ 탭 줄 없음 · 제목 "후원 필터링") | `/filtering` | `328:12707` |
| 리모컨 | HP60 | 리모컨 (W04 Main + "↗ 작은 창으로 열기") | `/remote` | `328:13227` |
| 리모컨 | HP61 | 리모컨 가이드 (할 수 있는 것 · 리모컨 주소 · 여는 방법 3단계 · 알아 두기) | `/remote/guide` | `332:6875` |
| 리모컨 | HP62 | 리모컨 작은 창 (1000 폭, 메뉴 · 작은 창 버튼 없음) | `/popout/remote` | `332:7615` |
| 모바일 | HP70 · HP71 | 시작하기 · 375 / 메뉴 서랍 열림 · 375 (Helper Mobile Bar, 서랍 300 폭) | `/` | `332:7618` · `332:7828` |
