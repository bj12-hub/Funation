# Somnation 사이트 — 편집 가능한 디자인 (현재 구현 파일 7–10 페이지)

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
| 10 레이아웃 · 사이트 | `74:2` | 컴포넌트로 조합한 사이트 화면 (헤더 · 사이드 메뉴 · 푸터 인스턴스) |

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
| 통합 채팅 | C04 | 매니저 채팅창 · 전체 권한 (440 × 780) | `/popout/chat/m/[token]` | `123:8311` |
| 통합 채팅 | C04b | 매니저 채팅창 · 전체 권한 · 메시지에 마우스 올림 (데스크톱) | `/popout/chat/m/[token]` | `124:110` |
| 통합 채팅 | O04 | 통합 채팅 오버레이 (400 × 600) | `/overlay/chat/[key]` | `49:504` |
| 통합 채팅 | O04b | 통합 채팅 오버레이 · 숨김 반영 후 (400 × 600, C01b에서 숨긴 메시지가 빠진 상태) | `/overlay/chat/[key]` | `130:51` |
| 통합 채팅 | O04c | 통합 채팅 오버레이 · 리모컨 기능 제어 OFF (400 × 600, 아무것도 표시 안 함) | `/overlay/chat/[key]` | `132:2` |
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
| 방송 · 위젯 | W01b | 커스텀 사운드 팝업 (라이브러리에서 고르기) | `/creator/widgets` | `144:8419` |
| 방송 · 위젯 | W01c | 뽑기 후원 팝업 (당첨 효과음 · 라이브러리) | `/creator/widgets` | `144:8944` |
| 방송 · 위젯 | W01d | 투표 위젯 팝업 (무료 · 1인 1표, 프리셋) | `/creator/widgets` | `161:9654` |
| 방송 · 위젯 | W01e | 룰렛 설정 팝업 (항목 · 확률, 크리에이터 상품) | `/creator/widgets` | `164:9319` |
| 방송 · 위젯 | W02 | 방송 도구 | `/creator/widgets/tools` | `64:1471` |
| 방송 · 위젯 | W03 | 오버레이 주소 (후원 위젯 9종 · 투표 · 룰렛 포함 20개) | `/creator/widgets/overlays` | `160:4982` |
| 방송 · 위젯 | W04 | 리모컨 (기능 제어 · 볼륨 · 방송 도구 · 투표 · 룰렛 대기열) | `/creator/remote` | `163:5103` |
| 방송 · 위젯 | W05 | 이펙트 · 효과 | `/creator/widgets/effects` | `66:1840` |
| 방송 · 위젯 | W06 | 시그니처 후원 (편집 열림) | `/creator/widgets/signatures` | `66:2016` |
| 방송 · 위젯 | W07 | 영상 후원 | `/creator/widgets/video` | `66:2322` |
| 방송 · 위젯 | W08 | 그림후원 | `/creator/widgets/drawing` | `66:2498` |
| 방송 · 위젯 | W09 | 이미지·사운드 | `/creator/widgets/assets` | `66:2653` |
| 방송 · 위젯 | W10 | 배너 (기능 제어 OFF 안내 · 배너 OFF 예시) | `/creator/widgets/banner` | `66:2782` |
| 방송 · 위젯 | W11 | 후원 연동 | `/creator/widgets/link` | `67:2520` |
| 크루 방송 | Y03 | 크루 관리 | `/creator/crew` | `67:2696` |
| 크루 방송 | Y04 | 크루 방송 운영 (방송 전 · 시나리오 편집) | `/creator/crew/broadcast` | `116:3886` |
| 크루 방송 | Y04b | 크루 방송 운영 (방송 중 · 자동엑셀 · 배틀 · 기여도 강탈 · 시나리오, 예시 입력값) | `/creator/crew/broadcast` | `117:3911` |
| 후원 관리 | T03 | 받은 후원 (퀘스트 성공 · 실패 · 취소, 실패 · 취소 시 환불) | `/creator/donations?tab=list` | `158:13983` |
| 후원 관리 | T03b | 후원 순위 | `/creator/donations?tab=ranking` | `68:2958` |
| 후원 관리 | T03c | 후원 필터링 | `/creator/donations?tab=filtering` | `68:3293` |
| 후원 관리 | T03d | 받은 후원 · 게임 후원 (룰렛 · 퀴즈) | `/creator/donations?tab=list&kind=game` | `142:4530` |
| 후원 관리 | T03e | 받은 후원 · 크루 후원 (멤버 지정) | `/creator/donations?tab=list&kind=crew` | `143:4635` |
| 정산 | T04 | 정산 현황 + 체크리스트 | `/creator/settlement` | `68:3459` |
| 정산 | T04b | 정산 인증·등록 (이용동의) | `/creator/settlement/register` | `68:3655` |
| 정산 | T04c | 정산 자료 등록 | `/creator/settlement/register/form` | `69:3359` |
| 정산 | T04f | 정산 현황 (등록 완료) | `/creator/settlement` | `93:3479` |
| 정산 | T04d | 정산 신청 | `/creator/settlement/apply` | `93:3673` |
| 정산 | T04g | 정산 신청 팝업 (금액 입력) | `/creator/settlement/apply` | `94:7168` |
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
| 헤더 | S04 | 알림 | `/notifications` | `74:444` |
| 헤더 | S03 | 헤더 알림 팝오버 | `/` | `89:7290` |
| 탐색 | S05 | 크리에이터 찾기 | `/creators` | `74:646` |
| 탐색 | S06 | 전체 방송 | `/live` | `107:8173` |
| 탐색 | S06b | 인기 방송 | `/live/popular` | `107:8525` |
| 커뮤니티 · 이벤트 | S07 | 명예의 전당 | `/hall-of-fame` | `75:1117` |
| 커뮤니티 · 이벤트 | S08 | 커뮤니티 | `/community` | `75:1375` |
| 커뮤니티 · 이벤트 | S08b | 커뮤니티 글 상세 | `/community/p-1` | `75:1591` |
| 커뮤니티 · 이벤트 | S09 | 커뮤니티 글쓰기 | `/community/new` | `76:1342` |
| 커뮤니티 · 이벤트 | S09b | 커뮤니티 글 수정 (작성자만) | `/community/[id]/edit` | `151:8418` |
| 커뮤니티 · 이벤트 | S10 | 이벤트 | `/events` | `76:1541` |
| 커뮤니티 · 이벤트 | S10b | 이벤트 상세 | `/events/ev-first-donation` | `76:1753` |
| 고객센터 | S11 | 고객센터 | `/support` | `76:1941` |
| 고객센터 | S12 | 공지 상세 | `/support/notices/brand` | `76:2163` |
| 크리에이터 채널 | C01 | 채널 홈 + 투표 카드(투표한 상태) · 월간 랭킹 · 커뮤니티 | `/creators/c1` | `161:8946` |
| 크리에이터 채널 | C02 | 크루 탭 | `/creators/c4` | `76:2695` |
| 크리에이터 채널 | C03 | 영상 탭 | `/creators/c1` | `77:2513` |
| 크리에이터 채널 | C04 | 커뮤니티 탭 | `/creators/c1` | `77:2803` |
| 크리에이터 채널 | C05 | 시그니처 탭 | `/creators/c1` | `77:3079` |
| 크리에이터 채널 | C06 | 소개 탭 | `/creators/c1` | `77:3353` |
| 크리에이터 채널 | C07 | 내 채널 만들기 (주소 확인 완료 · 예시 입력값, 코드로 그린 레이아웃 — 크리에이터 계정은 이 화면이 열리지 않음) | `/channel/new` | `151:8173` |
| 방송 방 후원 패널 | D-TEXT | 일반 | `/creators/c1?tab=donation` | `77:3595` |
| 방송 방 후원 패널 | D-MINI | 미니 | `/creators/c1?tab=donation` | `78:3182` |
| 방송 방 후원 패널 | D-VIDEO | 영상 (URL 입력만) | `/creators/c1?tab=donation` | `154:9022` |
| 방송 방 후원 패널 | D-SIGNATURE | 시그니처 | `/creators/c1?tab=donation` | `78:3330` |
| 방송 방 후원 패널 | D-WISHLIST | 위시 | `/creators/c1?tab=donation` | `78:3398` |
| 방송 방 후원 패널 | D-LUCKYBOX | 럭키박스 | `/creators/c1?tab=donation` | `78:3465` |
| 방송 방 후원 패널 | D-ROULETTE | 룰렛 (크리에이터 항목 · 확률, 내 룰렛) | `/creators/c1?tab=donation` | `164:8940` |
| 방송 방 후원 패널 | D-QUEST | 퀘스트 (실패 · 취소 시 전액 환불) | `/creators/c1?tab=donation` | `158:8946` |
| 방송 방 후원 패널 | D-DRAWING | 그림 | `/creators/c1?tab=donation` | `79:3259` |
| 방송 방 후원 패널 | D-QUIZ_CHOICE | 객관식 퀴즈 | `/creators/c1?tab=donation` | `79:3329` |
| 방송 방 후원 패널 | D-QUIZ_INITIAL | 초성 퀴즈 | `/creators/c1?tab=donation` | `79:3418` |
| 방송 방 후원 패널 | D-QUIZ_DRAWING | 그림 퀴즈 | `/creators/c1?tab=donation` | `79:3495` |
| 방송 방 후원 패널 | D-crew-member | 크루 멤버 지정 | `/creators/c4?tab=donation` | `79:3580` |
| 방송 방 후원 패널 | D-confirm | 후원하기 확인 + 후원 알림 미리보기 (613:6 + code-first) | `/creators/c1?tab=donation` | `112:8173` |
| 플랫폼 후원 | P01 | SOOP 후원 | `/donation/soop` | `80:3182` |
| 플랫폼 후원 | P02 | FlexTV 후원 | `/donation/flextv` | `80:3424` |
| 플랫폼 후원 | P03 | 플랫폼 크리에이터 검색 | `/donation/soop/search` | `80:3665` |
| 플랫폼 후원 | P04 | 플랫폼 크리에이터 후원 | `/donation/soop/kim_stream` | `80:3859` |
| 플랫폼 후원 | P05 | 플랫폼 후원 내역 | `/donation/history` | `80:4080` |
| 마이 | M01 | 마이페이지 | `/mypage` | `81:4024` |
| 마이 | M02 | 칭호·등급 | `/mypage/titles` | `81:4359` |
| 마이 | M03 | 별명 관리 | `/mypage/nicknames` | `81:4688` |
| 마이 | M04 | 내 후원 랭킹 | `/mypage/ranking` | `82:4528` |
| 마이 | M06 | 쪽지 | `/messages` | `82:4849` |
| 마이 | M07 | 즐겨찾기 | `/favorites` | `82:5066` |
| 마이 | M09 | 출석체크 | `/attendance` | `82:5322` |
| 마이 | M10 | 차단 관리 (차단한 사용자 2명) | `/mypage/blocks` | `151:8644` |
| 마이 | M10b | 차단 관리 · 비어 있음 | `/mypage/blocks` | `151:8861` |
| FN 지갑 | M05 | FN Wallet | `/wallet` | `84:5202` |
| FN 지갑 | M05b | FN 충전 (모달) | `/wallet` | `85:5369` |
| FN 지갑 | M05c | 충전 내역 | `/wallet/charges` | `86:5536` |
| FN 지갑 | M05d | 후원 내역 | `/wallet/donations` | `87:5705` |
| 인증 | A01 | 로그인 | `/login` | `88:5879` |
| 인증 | A02 | 로그인 (크리에이터) | `/login?role=creator` | `89:6882` |
| 인증 | A03 | 회원가입 | `/signup` | `88:5941` |
| 인증 | A04 | 비밀번호 재설정 | `/password-reset` | `88:6027` |
| 인증 | A05 | 비밀번호 변경 | `/login/password-change` | `88:6072` |
| 인증 | A06 | 홈 (비로그인, 게스트 헤더) | `/` | `89:6579` |
| 약관 | L01 | 서비스 이용약관 | `/terms/service` | `88:6124` |
| 약관 | L02 | 개인정보 처리방침 | `/terms/privacy` | `88:6307` |
| OBS 오버레이 | O02 | 후원 알림 (800×600) | `/overlay/alert/[key]` | `92:6819` |
| OBS 오버레이 | O02b | 후원 알림 · 등급·칭호 배지 (실제 후원) | `/overlay/alert/[key]` | `112:8207` |
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
| OBS 오버레이 | O19 | 투표 (600×500, 진행 중 · 표 수는 예시) | `/overlay/widget/vote/[key]` | `161:9339` |
| OBS 오버레이 | O20 | 룰렛 (640×360, 회전 중) | `/overlay/widget/roulette/[key]` | `164:9017` |
| OBS 오버레이 | O20b | 룰렛 (640×360, 결과 공개) | `/overlay/widget/roulette/[key]` | `164:9032` |

OBS 오버레이는 투명 배경이라 회색 바탕 위에 그렸어요. 테스트 후원 · 테스트 그림 · 방송 도구 켜기 · 크루 방송 시작으로 띄운 상태를 읽었고, 이펙트(무작위 파티클)와 영상(외부 임베드)은 코드 구조대로 그린 예시 배치예요. 통합 채팅 오버레이는 9 페이지(O04 `49:504`)에 있어요. 아이콘은 회색 자리표시 사각형이에요.
