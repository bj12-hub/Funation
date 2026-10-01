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

## 레이아웃

| ID | 화면 | 라우트 | 노드 |
|---|---|---|---|
| C01 | 통합 채팅 | `/creator/chat` | `49:2` |
| O04 | 통합 채팅 오버레이 (400 × 600) | `/overlay/chat/[key]` | `49:504` |

다음 단계: 스튜디오의 다른 화면(대시보드 · 위젯 · 리모컨 · 후원 연동 …)을 같은 컴포넌트로 옮기고, 필요한 컴포넌트를
추가해요. 화면 속 이름 · 숫자는 예시 값이에요.
