# Somnation Admin — 디자인 시스템 (별도 Figma 파일)

어드민 앱(`apps/admin`, admin 서브도메인)의 디자인 원본이에요. 사이트 디자인(펀페이 · 현재 구현 파일)과 분리된
**운영 전용 디자인**이고, 레이어 · 컴포넌트를 직접 편집할 수 있어요.

- 파일: [Somnation Admin](https://www.figma.com/design/Js5MCzkGmAZ9QY0w3nLUe8) (`Js5MCzkGmAZ9QY0w3nLUe8`, FLEX_ENM 팀)
- 만든 날: 2026-10-01 · v1
- 테마: Light 업무용 화면 + 어두운 사이드바, 포인트 색 인디고. 글꼴 Noto Sans KR(한글 UI) + Inter(숫자)
- 코드 토큰: `apps/admin/src/styles/tokens.css` (`--adm-*`). 사이트 토큰(`apps/web/src/styles/tokens.css`)은 쓰지 않아요.

## 페이지

| 페이지 | 노드 | 내용 |
|---|---|---|
| Cover | `0:1` | 파일 표지 |
| Foundations | `1:80` | 색 · 글자 · 간격 · 모서리 토큰 견본 |
| Components | `1:81` | 기본 · 조합 컴포넌트 |
| Screens | `1:82` | 컴포넌트 인스턴스로 구성한 주요 화면 |

## 토큰 (Figma 변수 → CSS)

Figma 변수의 WEB 코드 문법이 CSS 변수 이름과 같아요 (`color/bg/page` → `--adm-color-bg-page`).
변경은 Figma 변수를 먼저 고친 뒤 `tokens.css`에 같은 값을 반영해요.

| 컬렉션 | 변수 | CSS |
|---|---|---|
| Color (mode Light) | `color/bg/*` page · surface · subtle · hover · sidebar · sidebar-active | `--adm-color-bg-*` |
| | `color/text/*` primary · secondary · tertiary · inverse · sidebar · sidebar-active | `--adm-color-text-*` |
| | `color/border/*` default · strong | `--adm-color-border-*` |
| | `color/accent/*` default · hover · soft · text | `--adm-color-accent-*` |
| | `color/status/*` success · warning · danger · info (bg / text), danger | `--adm-color-status-*` |
| Dimension | `space/1–10` (4 · 8 · 12 · 16 · 20 · 24 · 32 · 40) | `--adm-space-*` |
| | `radius/sm · md · lg · xl · full` (4 · 6 · 8 · 12 · 999) | `--adm-radius-*` |
| Primitives | gray · indigo · green · amber · red · blue 원색 (숨김, 시맨틱 변수의 별칭 원본) | — |

텍스트 스타일 `Admin/*` → `--adm-text-*` (font 단축 속성):
Display 24 Bold · Title 18 Bold · Subtitle 15 Medium · Body 14 · Body Strong 14 Medium · Caption 12 · Label 12 Medium · Number 24 Inter Semi Bold.

## 컴포넌트 ↔ 코드

| Figma 컴포넌트 | 노드 | 속성 | 코드 |
|---|---|---|---|
| Button | `2:14` | Style = Primary · Secondary · Danger, State = Default · Disabled, Label | `admin.module.css` `.primary` · `.button` · `.danger` |
| Badge | `2:25` | Tone = Success · Warning · Danger · Info · Neutral, Label | `.chipOk` · `.chipWarn` · `.chipBad` · `.chipInfo` · `.chipNeutral` |
| Input | `2:30` | State = Default · Focus, Placeholder | `.input` · `.textarea` |
| Tab | `2:37` | State = Active · Inactive, Label | `.tabs` · `.tab[aria-current]` |
| SideNav Item | `2:44` | State = Default · Active, Label | `shell.module.css` `.sideItem` · `.sideItemActive` |
| Stat Card | `3:2` | Label · Value · Hint | `.tile` · `.tileValue` |
| Table Header / Row | `3:6` · `3:12` | — | `.table th` · `.table td` |
| Page Header | `3:20` | Title · Description · Show actions | `.pageHead` · `.title` |
| Sidebar | `3:29` | 메뉴는 `AdminChrome.tsx` `ADMIN_GROUPS`와 같아요 | `AdminSideNav` |
| Topbar | `3:63` | Breadcrumb | `AdminTopbar` (경로 · MOCK · 사이트 열기 · 운영자 · 로그아웃) |

## 화면

| ID | 화면 | 라우트 | 노드 |
|---|---|---|---|
| A-00 | 로그인 | `/login` (오류 · 404도 같은 카드) | `7:884` |
| A-01 | 운영 대시보드 | `/` | `5:2` |
| A-02 | 회원 관리 | `/members` | `5:146` |
| A-03 | 회원 상세 | `/members/[id]` | `5:290` |
| A-04 | 결제 · 환불 (환불 요청) | `/payments?tab=refunds` | `5:405` |
| A-05 | 정산 심사 | `/settlements` | `7:348` |
| A-06 | 신고 처리 | `/reports` | `7:483` |
| A-07 | 콘텐츠 관리 | `/content` | `7:613` |
| A-08 | 감사 로그 | `/audit` | `7:752` |
| A-09 | 크리에이터 관리 | `/creators` | `12:729` |
| A-10 | 후원 운영 | `/donations` | `12:854` |
| A-11 | 플랫폼 연동 | `/platforms` | `12:1024` |
| A-12 | 시스템 | `/system` | `12:1157` |

사이드바의 모든 메뉴(11개)에 Figma 화면이 있어요. 새 화면은 위 컴포넌트를 조합해서 만들어요.

화면 속 숫자 · 이름은 예시 값이에요. 수수료율 · 환불 정책 · 정산 일정 · 운영자 인증 방식은 TBD예요.

## 다른 파일과의 관계

- `Somnation — 현재 구현 (2026-09)` 파일의 `6 어드민` 페이지([current-build.md](current-build.md))는 화면 캡처 기록이에요 (2026-10-01 어드민 전용 디자인으로 다시 캡처).
  어드민 디자인 원본은 이 파일이에요.
- 펀페이 파일은 읽기 전용이고 어드민 디자인을 포함하지 않아요.
