# Route ↔ Figma map

Status: ✅ implemented · 🚧 placeholder (link works, screen pending)

| Route | Status | Figma frames |
|---|---|---|
| `/` | ✅ | funation-videos-page 727:2742 |
| `/login` | ✅ | 13:7 · 718:123 · 718:168 · 718:213 |
| `/signup` | ✅ | 280:56 · 13:63 · 722:473 · 722:536 · 722:599 · 45:39 · 722:692–722:1059 · 723:183 |
| `/password-reset` | ✅ | 13:179 · 718:626 · 718:582 · 720:18 · 720:60 · 720:103 · 718:244 |
| `/live` | ✅ | funnation-all-live-page 617:316 (전체라이브) — `?category=` preselects a category |
| `/live/popular` | ✅ | funnation-popular-live-page 617:5 (인기라이브) |
| `/creators` | ✅ | funation-all-creators-page 690:5 — `?category=` `?q=` `?sort=` `?page=` |
| `/hall-of-fame` | 🚧 | 3:637 |
| `/support` | 🚧 | 고객센터 4:7 (previously listed under `/creators` by mistake) |
| `/mypage` | 🚧 | 622:4 · 735:4119 |
| `/terms/[slug]` | 🚧 | 722:3 (terms text pending) — slugs: youth, service, privacy, marketing, operation |

## Link wiring

| From | Element | To |
|---|---|---|
| Header | 로고 | `/` |
| Header | LIVE · 인기 크리에이터 · 명예의 전당 · 고객센터 | `/live` · `/creators` · `/hall-of-fame` · `/support` |
| Header | 마이페이지 / 로그인 | `/mypage` / `/login` |
| Header | 언어 선택 | dropdown (265:242) — i18n pending |
| Login | 비밀번호 찾기 · 회원가입 | `/password-reset` · `/signup` |
| Login lockout | 비밀번호 재설정으로 이동 · 고객센터 | `/password-reset` · `/support` |
| Signup | 약관 `>` | `/terms/{youth,service,privacy,marketing}` (new tab) |
| Signup | 로그인 | `/login` |
| Signup complete | 로그인 페이지로 이동 · 간편 로그인 연동하러 가기 | `/login` · `/mypage` |
| Password reset | 로그인으로 돌아가기 | `/login` |
| Home | 히어로 바로 시청하기 · 지금 뜨는 영상 · 랭킹 · 현재 라이브 방송 | `/live` (live detail route pending) |
| Home | 인기 크리에이터 · 전체보기 | `/creators` |
| Home | 보관함에 저장 · 이벤트 배너 지금 참여하기 | not wired — destination TBD |
| Footer | 이용약관 · 개인정보처리방침 · 청소년보호정책 · 운영정책 | `/terms/{service,privacy,youth,operation}` |
| Footer | 고객지원 links | `/support` |
| Footer | 회사소개 links · SNS icons | plain text — destinations TBD |
| Live tabs | 인기라이브 · 전체라이브 | `/live/popular` · `/live` |
| Live popular | 섹션 제목 `>` | `/live?category=<CATEGORY>` |
| Side nav (live) | 홈 · 추천 라이브 · 실시간 인기 급상승 | `/` · `/live` · `/live/popular` |
| Side nav (live) | 즐겨찾기 · 출석체크 · 설정 · FN 충전 · QR 충전 · FN 내역 | not wired — screens pending |
| Side nav (live) | 로그인 (guest card) · 마이페이지 | `/login` · `/mypage` |
| Creators | 카테고리 탭 · 검색 · 정렬 · 페이지 | `/creators?category=&q=&sort=&page=` |
| Creators | 크리에이터 카드 | not wired — creator detail pending |
