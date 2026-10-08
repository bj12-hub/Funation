# Ssumnation Admin — 디자인 시스템 (별도 Figma 파일)

어드민 앱(`apps/admin`, admin 서브도메인)의 디자인 원본이에요. 사이트 디자인(펀페이 · 현재 구현 파일)과 분리된
**운영 전용 디자인**이고, 레이어 · 컴포넌트를 직접 편집할 수 있어요.

- 파일: [Ssumnation Admin](https://www.figma.com/design/Js5MCzkGmAZ9QY0w3nLUe8) (`Js5MCzkGmAZ9QY0w3nLUe8`, FLEX_ENM 팀)
- 만든 날: 2026-10-01 · v1
- 테마: Light 업무용 화면 + 어두운 사이드바, 포인트 색 인디고. 글꼴 Noto Sans KR(한글 UI) + Inter(숫자)
- 코드 토큰: `apps/admin/src/styles/tokens.css` (`--adm-*`). 사이트 토큰(`apps/web/src/styles/tokens.css`)은 쓰지 않아요.

## 페이지

| 페이지 | 노드 | 내용 |
|---|---|---|
| Cover | `0:1` | 파일 표지 |
| Foundations | `1:80` | 색 · 글자 · 간격 · 모서리 토큰 견본 |
| Components | `1:81` | 기본 · 조합 컴포넌트 |
| Screens | `1:82` | 컴포넌트 인스턴스로 구성한 주요 화면 (v1, 손으로 조합) |
| Layouts | `16:2` | 실제 어드민 화면 구조를 읽어 만든 편집 가능한 레이아웃 (전체 화면 · 탭) |

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

## 레이아웃 (Layouts 페이지)

2026-10-02. 실제 어드민 화면(`apps/admin`, mock 데이터)의 구조를 읽어 다시 그린 편집 가능한 레이아웃이에요. 색은 `color/*` 변수,
글자는 `Admin/*` 텍스트 스타일, 사이드바 · 상단바 · 버튼 · 배지 · 입력창 · 탭은 위 컴포넌트 인스턴스예요. 사이드바는 화면마다
해당 메뉴가 Active예요. 섹션은 사이드바 묶음 순서예요. 만드는 방법은 `scripts/figma/README.md`(admin-walker · admin-renderer).

| 섹션 | ID | 화면 | 라우트 | 노드 |
|---|---|---|---|---|
| 인증 | AD01 | 로그인 | `/login` | `16:3` |
| 개요 | AD02 | 운영 대시보드 | `/` | `20:909` |
| 개요 | AD03 | 감사 로그 | `/audit` | `20:1055` |
| 회원 | AD04 | 회원 관리 | `/members` | `17:134` |
| 회원 | AD05 | 회원 상세 · 이용 정지 | `/members/m-c10` | `20:1193` |
| 회원 | AD05b | 회원 상세 · 탈퇴 (소멸 FN · 정산 대기 수익 기록, 이용 제한 변경 불가) | `/members/u-hongGD123` | `22:2160` |
| 회원 | AD05c | 회원 상세 · 탈퇴 회원 정보 보관 (분류 · 보관 기한 · 기간 · 근거 · 포함, 기본값 · 법무 검토 전, code-first) | `/members/u-hongGD123` | `31:1217` |
| 회원 | AD06 | 크리에이터 관리 | `/creators` | `17:1627` |
| 거래 | AD09 | 후원 운영 | `/donations` | `18:333` |
| 거래 | AD07 | 결제 · 충전 내역 | `/payments` | `18:651` |
| 거래 | AD08 | 환불 요청 | `/payments?tab=refunds` | `20:1301` |
| 거래 | AD08b | 환불 요청 · 환불 정책 계산 (요청 때 계산 / 지금 기준 · 요청 때와 같아요, 정책 안내, 기본값, code-first) | `/payments?tab=refunds` | `31:1115` |
| 거래 | AD08c | 환불 요청 · 보류 ("보류 N" 묶음, 보류 메모 · 보류 해제, 2026-10-08 결정, code-first) | `/payments?tab=refunds` | `32:1483` |
| 거래 | AD10 | 정산 심사 | `/settlements` | `18:1095` |
| 거래 | AD10b | 정산 심사 · 승인 (이체 참조번호 · "지급 완료 처리" + 보류 메모 · "보류", 2026-10-08 결정, code-first — 카드 2개만) | `/settlements?status=APPROVED` | `32:1348` |
| 거래 | AD10e | 정산 심사 · 보류 ("보류 N" 탭, 보류 · 원래 상태 칩, 보류 메모 · 보류 해제, 2026-10-08 결정, code-first) | `/settlements?status=HELD` | `32:1231` |
| 거래 | AD10d | 정산 심사 · 지급 완료 ("지급 완료 {일시} · {처리자} · 이체 참조 {번호}", 2026-10-08 결정, code-first) | `/settlements?status=PAID` | `27:1097` |
| 운영 | AD11 | 신고 처리 | `/reports` | `20:1414` |
| 운영 | AD12 | 콘텐츠 관리 · 공지 | `/content` | `18:1308` |
| 운영 | AD13 | 콘텐츠 관리 · FAQ | `/content?tab=faq` | `19:699` |
| 운영 | AD14 | 플랫폼 연동 | `/platforms` | `19:987` |
| 운영 | AD15 | 시스템 · 공지 배너 | `/system` | `19:1133` |

목록이 찬 상태는 사이트에서 예시 환불 요청 3건 · 신고 4건을 만들고, 어드민에서 환불 승인 · 거절, 신고 숨김 · 기각, 회원(STAR BEATS) 7일 정지를 처리한 mock 상태예요.
화면 속 사유 · 메모는 모두 "(예시)" 문구예요. 서버를 다시 시작하면 mock이 초기화돼요.

## 다른 파일과의 관계

- `Ssumnation — 현재 구현 (2026-09)` 파일의 `6 어드민` 페이지([current-build.md](current-build.md))는 화면 캡처 기록이에요 (2026-10-01 어드민 전용 디자인으로 다시 캡처).
  어드민 디자인 원본은 이 파일이에요.
- 펀페이 파일은 읽기 전용이고 어드민 디자인을 포함하지 않아요.
