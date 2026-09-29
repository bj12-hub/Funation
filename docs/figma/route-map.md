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
| `/hall-of-fame` | ✅ | funation-hall-of-fame 3:637 — `?period=all|week|day` (default 이번 달) |
| `/support` | ✅ | 고객센터 4:7 — `?q=` searches the FAQ |
| `/mypage` | ✅ | funation-my-page 735:4119 · 622:4 — redirects to `/login` without a session |
| `/favorites` | ✅ | funation-favorites-page 735:3856 — signed-in only, `?q=` `?page=` |
| `/creators/[id]` | ✅ | 라이브 826:685 (채팅) · 610:138 (후원), 오프라인 710:195, 공유 826:387 · 후원 유형 851:4546 (일반) · 851:4665 (미니) · 851:4788 (영상) · 851:4929 + 875:1815 (시그니처) · 851:5054 (위시) · 851:5174 + 875:6948–8546 (럭키박스) · 후원 확인 613:6 · 완료 613:122 · FN 부족 613:237 — 룰렛·퀘스트·그림·퀴즈 pending |
| `/wallet/charges` | ✅ | FN 충전내역 640:2 · 639:2 (empty) · 상세 643:4 · 644:6 · 644:185 · 644:364 — signed-in only, `?period=` `?from=` `?to=` `?page=` |
| `/wallet/donations` | ✅ | FN 후원내역 632:4 · 637:214 (empty) — signed-in only, `?type=` (basic · quest · game) + period params |
| `/wallet` | ✅ | redirects to `/wallet/charges` |
| `/attendance` | ✅ | funation-attendance-page 583:4 · 585:452 (checked in) · 585:66 (완료 popup) · 585:830 (보상 popup) — signed-in only |
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
| Home | 인기 크리에이터 | `/creators/[id]` |
| Home | 인기 크리에이터 전체보기 | `/creators` |
| Home | 보관함에 저장 · 이벤트 배너 지금 참여하기 | not wired — destination TBD |
| Footer | 이용약관 · 개인정보처리방침 · 청소년보호정책 · 운영정책 | `/terms/{service,privacy,youth,operation}` |
| Footer | 고객지원 links | `/support` |
| Footer | 회사소개 links · SNS icons | plain text — destinations TBD |
| Live tabs | 인기라이브 · 전체라이브 | `/live/popular` · `/live` |
| Live popular | 섹션 제목 `>` | `/live?category=<CATEGORY>` |
| Side nav (live) | 홈 · 추천 라이브 · 실시간 인기 급상승 | `/` · `/live` · `/live/popular` |
| Side nav | 즐겨찾기 | `/favorites` |
| Side nav | FN 내역 | `/wallet/charges` |
| Side nav | FN 충전 · 모바일에서 충전 (QR코드) | charge modal 595:1869 · QR popup 587:147 (QR target TBD) |
| Side nav | 출석체크 | `/attendance` |
| Side nav | 시청 기록 · 설정 | not wired — screens pending |
| Side nav (live) | 로그인 (guest card) · 마이페이지 | `/login` · `/mypage` |
| Creators | 카테고리 탭 · 검색 · 정렬 · 페이지 | `/creators?category=&q=&sort=&page=` |
| Creators | 크리에이터 카드 | `/creators/[id]` |
| Favorites | 크리에이터 이름 | `/creators/[id]` |
| Creator room | 즐겨찾기 · 공유 · 채팅 탭 | favorite server action · share modal · local chat echo |
| Creator room | 후원하기 | 확인 → 완료 popups (donation server action) · FN 부족 → charge modal |
| FN 내역 | 충전 내역 · 후원 내역 탭 · 마이페이지 breadcrumb | `/wallet/charges` · `/wallet/donations` · `/mypage` |
| FN 내역 | CSV 다운로드 | `/api/wallet/charges` · `/api/wallet/donations` (session required) |
| FN 내역 | FN 충전 | charge modal (595:1869 · 595:5475 · 601:839 · 606:540 · 739:*) |
| FN 내역 | 매출전표 영수증 | not wired — payment provider pending |
| Hall of fame | 기간 탭 | `/hall-of-fame?period=` |
| Hall of fame | 나도 서포터 되기 | not wired — destination TBD |
| My page | 랭킹 노출 · 마케팅 동의 토글 | saved via account service (mock) |
| My page | 사진 변경 · 닉네임/ID 수정 · 비밀번호 변경 | modals 743:1955 · 743:1997 · 743:2040 · 743:2084 (server actions, mock) |
| My page | 로그인 연동 관리 · 인증하기 · 플랫폼 연결/해제 | modals 743:2133–2227 · 743:2274 + 750:* · 743:2442 · 743:2488 (mock hand-offs, TBD) |
| My page | FN 내역 | `/wallet/charges` |
| My page | FN 충전 | charge modal |
| My page | 회원 탈퇴 | not wired — flow pending |
| Support | 자주 묻는 질문 바로가기 · 비밀번호 FAQ | `#faq` · `/password-reset` |
| Support | 문의하기 · 가이드 보기 | not wired — screens pending |
