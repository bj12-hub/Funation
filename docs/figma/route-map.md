# Route ↔ Figma map

Status: ✅ implemented · 🚧 placeholder (link works, screen pending)

| Route | Status | Figma frames |
|---|---|---|
| `/` | ✅ | funation-videos-page 727:2742 · popups 709:2 / 688:646 · 200:115 · 200:223 |
| `/login` | ✅ | 13:7 · 718:123 · 718:168 · 718:213 · `/login/password-change` 718:335 (비밀번호 변경 권유, the login action redirects here when the password is old) — `?role=` from 280:2 is passed through (TBD) |
| `/signup` | ✅ | 280:56 · 13:63 · 722:473 · 722:536 · 722:599 · 45:39 · 722:692–722:1059 · 723:183 |
| `/password-reset` | ✅ | 13:179 · 718:626 · 718:582 · 720:18 · 720:60 · 720:103 · 718:244 |
| `/live` | ✅ | funnation-all-live-page 617:316 (전체라이브) — 인기 / 전체 두 구분만, 주제 카테고리 없음 |
| `/live/popular` | ✅ | funnation-popular-live-page 617:5 (인기라이브) |
| `/creators` | ✅ | funation-all-creators-page 690:5 — `?category=` `?q=` `?sort=` `?page=` |
| `/hall-of-fame` | ✅ | funation-hall-of-fame 3:637 — `?period=all|week|day` (default 이번 달) |
| `/support` | ✅ | 고객센터 4:7 — `?q=` searches the FAQ |
| `/mypage` | ✅ | funation-my-page 735:4119 · 622:4 — redirects to `/login` without a session |
| `/channel/new` | ✅ code-first | 내 채널 만들기 — signed-in non-creators; grants the Creator role (review/approval TBD); Figma C07 `151:8173` (현재 구현 레이아웃) |
| `/creator/crew/broadcast` | ✅ code-first | 크루 방송 운영 — score = FN during the broadcast + 보정 (points are not money); Figma Y04 `116:3886` · Y04b 방송 중 `117:3911` · Y04c 배틀 배수 · 벌칙, 강탈 기준 `185:5234` · Y04e 팬 메시지 · 요청사항 `217:5990` (현재 구현 레이아웃) |
| `/overlay/crew/[key]` | ✅ code-first | OBS scoreboard overlay; `key` = integration key (reissue invalidates it); Figma O06 `92:6866` · O06b 배틀 `119:8173` · O06c 강탈 `119:8191` · O06d 시나리오 `119:8199` · OFF `133:2` (현재 구현 레이아웃) |
| `/creator/updates` | ✅ code-first | 업데이트 소식 — release notes, unread tracked on the server; Figma T05 `61:968` (현재 구현 레이아웃) |
| `/creator/remote` | ✅ code-first | 리모컨 — server-owned alert queue; 테스트 후원 is display only (no FN); 방송 도구; 투표 시작 · 종료 · 결과 내리기 (무료 투표); 룰렛 ▶ 시작 · 일시정지 · ✓ 완료; 뽑기 ✓ 완료 · 수령 처리 — W04 `218:5994` |
| `/overlay/alert/[key]` | ✅ code-first | OBS donation alert overlay; `key` = integration key; Figma O02 `92:6819` · O02b 등급 · 칭호 `112:8207` · OFF `133:25` (현재 구현 레이아웃) |
| `/creator/widgets/overlays` | ✅ code-first | 오버레이 주소 — every OBS overlay URL (key masked on screen) + OBS 씬 파일; Figma W03 `213:5870` (현재 구현 레이아웃) |
| `/creator/widgets/tools` | ✅ code-first | 방송 도구 remote — 자막 · 전광판 · 타이머 · 엔딩 크레딧 · 빙고 (server-owned state); Figma W02 `212:5861` (현재 구현 레이아웃) |
| `/overlay/tool/[tool]/[key]` | ✅ code-first | OBS overlays for the tools; `tool` = subtitle / marquee / timer / credits / bingo, `key` = integration key; Figma O08 자막 `92:6894` · O09 전광판 `92:6900` · O10 타이머 `92:6906` · O11 엔딩 크레딧 `92:6912` · OFF `133:82` · `133:89` · `133:96` · `133:103` (현재 구현 레이아웃) · O24 빙고 `215:9924` |
| `/creator/crew` | ✅ code-first | 크루 관리 — Creator role; member split of earnings TBD; Figma Y03 `200:5757` (현재 구현 레이아웃) |
| `/community` · `/community/new` · `/community/[id]` · `/community/[id]/edit` | ✅ code-first | 커뮤니티 — `?category=FREE|TIP|QNA|BUG|BRAG` `?q=` `?page=`; reading is public, writing needs a session, edits are author-only; moderation TBD; Figma S08 `75:1375` · S08b `75:1591` · S09 `76:1342` · S09b `151:8418` (현재 구현 레이아웃) |
| `/events` · `/events/[id]` | ✅ code-first | 이벤트 — `?filter=all|ongoing|upcoming|ended|mine`; join is recorded only, rewards TBD; Figma S10 `76:1541` · S10b `76:1753` (현재 구현 레이아웃) |
| `/messages` | ✅ code-first | 쪽지 — `?box=inbox|sent|archive|spam` `?q=` `?page=` `?to=<creatorId>` (opens compose); send limit placeholder (TBD); Figma M06 `199:9995` (현재 구현 레이아웃) |
| `/mypage/titles` | ✅ code-first | 칭호·등급 — grade / title thresholds are placeholders (TBD); Figma M02 `81:4359` (현재 구현 레이아웃) |
| `/mypage/ranking` | ✅ code-first | 내 후원 랭킹 — `?period=all|year|month`; other donors are mock sample data; Figma M04 `82:4528` (현재 구현 레이아웃) |
| `/mypage/nicknames` | ✅ code-first | 별명 관리; Figma M03 `81:4688` (현재 구현 레이아웃) |
| `/favorites` | ✅ | funation-favorites-page 735:3856 — signed-in only, `?q=` `?page=` |
| `/creators/[id]` | ✅ | 라이브 826:685 (채팅) · 610:138 (후원), 오프라인 710:195, 공유 826:387 · 후원 유형 851:4546 (일반) · 851:4665 (미니) · 851:4788 (영상) · 851:4929 + 875:1815 (시그니처) · 851:5054 (위시) · 867:2458 + 펀페이 1009:510 (룰렛) · 867:2545 (퀘스트) · 867:2647 (그림) · 뽑기 (code-first; 럭키박스 · 퀴즈는 2026-10-04 삭제) · 후원 확인 613:6 · 완료 613:122 · FN 부족 613:237 · 팬 메시지 · 요청사항 카드 C08 `215:9524` (현재 구현) |
| `/wallet/charges` | ✅ | FN 충전내역 640:2 · 639:2 (empty) · 상세 643:4 · 644:6 · 644:185 · 644:364 — signed-in only, `?period=` `?from=` `?to=` `?page=` |
| `/wallet/donations` | ✅ | FN 후원내역 632:4 · 637:214 (empty) — signed-in only, `?type=` (basic · quest · game) + period params; 퀘스트 탭: 내가 보낸 진행 중 퀘스트에 성공 / 실패 · 환불 (실패 = 전액 환불, 2026-10-04) |
| `/wallet` | ✅ | FN Wallet 817:7552 — 사용 가능 · 보류 중 (0, locking TBD) · 누적 사용 + 충전·사용·환불 list, `?kind=CHARGE|USE|REFUND` `?period=30|90|all` `?page=` (no running-balance column: needs a reconciled ledger, TBD) |
| `/creator` | ✅ | creator-dashboard 245:14 · profile dropdown 758:41 / 296:500 — signed-in only, `?period=` `?from=` `?to=` — Creator role required (non-creators see 크리에이터 권한이 필요합니다; how the role is granted is TBD) |
| `/creator/settings` | ✅ | creator-account-settings-page 315:405 · 315:2 · 프로필 수정 326:496 — signed-in only |
| `/creator/ranking` | ✅ | creator ranking 405:4 (퀘스트; 럭키박스 · 플레이 탭은 2026-10-04 삭제) — signed-in only, `?type=` `?period=` `?q=` `?page=` (scoring/season/tie rules TBD) |
| `/creator/widgets` | ✅ | donation-widget-notification-settings 529:4 — popups 364:6 (채팅창) · 364:158 (QR) · 364:265 (후원목표) · 372:7 (후원누적금액) · 531:1370 (최근알림) · 531:1598 (이벤트) · 531:1826 (미니후원) · 315:650 (후원랭킹) · 315:858 (투표) · 373:1307 (커스텀 사운드) · 373:1598 (퀘스트) · 373:3675 (뽑기 후원) · 395:145 (벽지) · code-first 룰렛 (럭키박스 · 플레이 위젯은 2026-10-04 삭제); 그림후원 + alert cards have no popup design (informational cards) — signed-in only |
| `/creator/donations` | ✅ | donation-management 539:7 (후원 페이지 설정) · 539:156 (후원 리스트, 퀘스트) · 539:303 (후원 순위) — `?tab=` `?kind=` `?period=` `?status=` `?q=` `?page=` · 539:466 / 539:574 (후원 필터링 · 차단 리스트, `?sub=filter|block`) · 539:690 (칭호 설정) — signed-in only |
| `/creator/settlement` | ✅ | settlement-management 429:4 · 정산 자료 등록 필요 433:4 · 이미 등록 462:2 · 본인인증 안내 T04h `222:15931` (`?gate=identity`, 2026-10-06 결정) — signed-in only; `?registered=1` shows the submitted toast; settlement date / minimum / payout schedule copy shown as designed, policy TBD |
| `/creator/settlement/register` | ✅ | 이용동의 429:139 (개인) · 443:257 (외국인) · 433:138 (개인사업자) · 437:338 (법인) · 대한민국 이외 452:4 / 452:47 — `?type=` preselects the member type; overseas answers lead nowhere yet (TBD) |
| `/creator/settlement/apply` | ✅ | 정산 신청 458:4 · 463:2 (승인 대기) — popups 466:2 (정산 관련 안내) · 469:195 / 469:2 (정산 신청) · 475:2 (수수료 안내) · 473:2 (확인) · 477:2 (완료) — registered creators only; minimum / fee / FN→KRW are server-side mock policy (Figma samples, TBD) |
| `/creator/settlement/manage` | ✅ | 정산 관리 478:2 · 479:144 (기간별) · 정산 정보 변경 480:2 — registered creators only, `?period=day|week|month|year|custom` `?from=` `?to=` `?page=` (filters by 신청일; default 연별) |
| `/creator/settlement/register/form` | ✅ | 정산 자료 등록 429:219 (개인) · 443:5 (외국인) · 433:210 (개인사업자) · 437:4 (법인) — `?type=` required, reachable only after 이용동의 for that type |
| `/donation/[platform]` | ✅ | SOOP 후원 817:9017 · FlexTV 후원 817:8317 — `soop` · `flextv`, signed-in only; 최근 후원 / 인기 lists (product panel moved to the detail step) |
| `/donation/history` | ✅ | 후원 내역 817:8038 · 817:8223 — `?tab=all|soop|flextv|direct` `?period=30|90|all` `?status=` `?q=` `?sort=newest|oldest` `?tx=` (거래 상세); 결과 건수 · 완료 합계(완료 건만 합산, code-first 2026-10-06); Direct = Funation creator-room donations (assumption, TBD) |
| `/donation/[platform]/search` | ✅ | 817:9146 · 817:8449 — `?q=`; results + empty |
| `/donation/[platform]/[creatorId]` | ✅ | 상세·상품 817:9242 / 817:8597 · 메시지·결제 817:9334 / 817:8684 · 확인 817:9411 / 817:8761 · 처리 중 817:9509 / 817:8843 · 완료 817:9553 / 817:8886 · 오류 817:9618 / 817:8948 · FN 부족 817:7699 · 세션 만료 817:7872 — prices from the server adapter catalog (FN ↔ 별풍선/하트 rate TBD) |
| `/attendance` | ✅ | funation-attendance-page 583:4 · 585:452 (checked in) · 585:66 (완료 popup) · 585:830 (보상 popup) — signed-in only |
| `/creator/chat` | ✅ code-first | 통합 채팅 — 치지직 · SOOP · FlexTV · YouTube 채팅, 채팅창 링크, 매니저 링크 (C01 `49:2` · C01b `129:2`) |
| `/popout/chat` | ✅ code-first | 통합 채팅창 (단독 웹페이지, 크리에이터 로그인) — C02 `120:8188` · C02b `127:3` |
| `/popout/chat/m/[token]` | ✅ code-first | 매니저 채팅창 (링크별 권한, 계정 없이) — C03 `123:8244` · C03b `125:2` · C04 `123:8311` · C04b `124:110` |
| `/creator/revenue` | ✅ code-first | 수익 현황 — T02 `200:5365` |
| `/creator/youtube` | ✅ code-first | 유튜브 연동 — Y01 `62:1539` |
| `/creator/videos` | ✅ code-first | 영상 목록 — Y02 `63:1255` |
| `/creator/widgets/effects` | ✅ code-first | 이펙트 · 효과 — W05 `66:1840` |
| `/creator/widgets/signatures` | ✅ code-first | 시그니처 후원 — W06 `201:5481`, 한 번에 만들기 W06b `209:5689` |
| `/creator/widgets/video` | ✅ code-first | 영상 후원 관리 — W07 `66:2322` |
| `/creator/widgets/drawing` | ✅ code-first | 그림후원 — W08 `66:2498` |
| `/creator/widgets/assets` | ✅ code-first | 이미지·사운드 라이브러리 — W09 `213:6371` |
| `/creator/widgets/banner` | ✅ code-first | 배너 (기능 제어 OFF 안내) — W10 `66:2782` |
| `/creator/widgets/link` | ✅ code-first | 후원 연동 (플랫폼 후원 → 후원 알림) + SMS 계좌후원 목업 (`POST /api/bank-sms/[key]`) — W11 `212:6116` |
| `/overlay/effects/[key]` | ✅ code-first | OBS 이펙트 — O03 `92:6828` · OFF O03-off `133:34` |
| `/overlay/video/[key]` | ✅ code-first | OBS 영상 후원 — O04 `92:6849` · OFF O04-off `133:56` |
| `/overlay/drawing/[key]` | ✅ code-first | OBS 그림후원 — O05 `92:6856` · OFF O05-off `133:64` |
| `/overlay/banner/[key]` | ✅ code-first | OBS 배너 — O07 `92:6888` · OFF O07-off `133:75` |
| `/overlay/chat/[key]` | ✅ code-first | OBS 통합 채팅 — O04 `49:504` · O04b `130:51` · OFF O04c `132:2` |
| `/overlay/widget/[widget]/[key]` | ✅ code-first | OBS 후원 위젯 — `widget` = goal · total · ranking · recent · event · qr · quest · vote · roulette · gacha · gacha-board · wallpaper; O12~O17 `146:8173`… · O18 `154:14403` · O19 `161:9339` (vote) · O20 `164:9017` / O20b `164:9032` (roulette) · O21 `166:8981` / O21b `166:8992` (gacha) · O22 `166:9003` (gacha-board) · O23 `175:8939` (wallpaper) · OFF O12-off `146:8241` |
| `/notifications` | ✅ code-first | 알림 — S04 `74:444` (헤더 벨 팝오버 S03 `89:7290`) |
| `/mypage/blocks` | ✅ code-first | 차단 관리 — M10 `151:8644` · 비어 있음 M10b `151:8861` |
| `/mypage/withdraw` | ✅ code-first | 회원 탈퇴 — M11 `182:9521` (크리에이터 · 남은 FN · 정산 대기 수익 소멸 동의, 비밀번호 확인) · M11b `182:9765` (비밀번호 불일치) · M11c `182:10010` (완료) · M11d `221:224` (처리 중인 충전 환불 → 탈퇴 불가) |
| `/support/notices/[id]` | ✅ code-first | 공지 상세 — S12 `76:2163` |
| `/terms/[slug]` | ✅ code-first (본문 TBD) | 722:3 (terms text pending) — slugs: service, privacy, youth, operation, marketing, creator. 2026-10-06 결정: 조항 목차만 자리표시(각 조항 "법무 검토 중 (TBD)", 시행일 · 버전 TBD), 문서 간 이동 탭 · 목차 앵커. 현재 구현 L01 `190:9523` · L02 `190:9788` (레이아웃), 캡처 `2:283` · `2:286` |

## Link wiring

| From | Element | To |
|---|---|---|
| Header | 로고 | `/` |
| Header | LIVE · 인기 크리에이터 · 명예의 전당 · 고객센터 | `/live` · `/creators` · `/hall-of-fame` · `/support` |
| Header | 마이페이지 | `/mypage` |
| Header | 로그인 (guest) | 로그인/회원가입 role chooser 280:2 → `/login?role=` (creator → `next=/creator` · donator → current page) |
| Header (creator) | 📺 크리에이터 · 고객센터 · 크리에이터 · 채널 메뉴 | `/creator` · `/support` · `/creator` · dropdown 758:41 (계정설정 `/creator/settings` · 로그아웃) |
| Profile menu (supporter) | 크리에이터 | `/creator` |
| Creator sidebar | 대시보드 | `/creator` |
| Creator sidebar | 후원위젯/알림설정 | `/creator/widgets` |
| Creator sidebar | 후원관리+ | `/creator/donations` |
| Creator sidebar | 크리에이터 랭킹 | `/creator/ranking` |
| Creator sidebar | 계정설정 | `/creator/settings` |
| Creator sidebar | 정산설정 | `/creator/settlement` |
| Settlement home | 정산 등록 · 정산 신청 · 정산 관리 cards | not registered → 433:4 (정산등록 → `/creator/settlement/register`); registered → 정산 등록 opens 462:2 (→ `/creator/settlement/manage`), 신청/관리 link to `/creator/settlement/apply` · `/creator/settlement/manage` |
| Settlement tabs | 정산 등록 · 정산 신청 · 정산 관리 | `/creator/settlement` · `/creator/settlement/apply` · `/creator/settlement/manage` |
| Settlement apply | 정산 신청 · 안내 bar / ⓘ · 자세히 보기 / 수수료 ⓘ · 더보기 | request popups · 466:2 · 475:2 · `/creator/settlement/manage` |
| Settlement manage | 정보 변경 → 480:2 변경하기 · 기간 presets / 조회 · 페이지 | clears the registration → `/creator/settlement/register` · `?period=` … |
| Settlement terms | 다음 | `/creator/settlement/register/form?type=` |
| Settlement form | 유형 탭 · 뒤로 · 신청하기 | 이용동의 for that type · 이용동의 · `/creator/settlement?registered=1` |
| Settlement form | 주소 검색 · 신분증/통장사본 안내 links | toast (address provider TBD) · labels only (guide pages TBD) |
| Creator dashboard | 계정 관리 · 정산 관리 | `/creator/settings` · `/creator/settlement/manage` (→ `/creator/settlement` when not registered) |
| Creator settings | OBS · Xsplit · 동시 송출 세팅 | setup guide popups 328:581 · 328:927 · 328:1266 (download links: official OBS / XSplit pages) |
| Header | 언어 선택 | dropdown (265:242) — i18n pending |
| Login | 비밀번호 찾기 · 회원가입 | `/password-reset` · `/signup` |
| Login lockout | 비밀번호 재설정으로 이동 · 고객센터 | `/password-reset` · `/support` |
| Signup | 약관 `>` | `/terms/{youth,service,privacy,marketing}` (new tab) |
| Signup | 로그인 | `/login` |
| Signup complete | 로그인 페이지로 이동 · 간편 로그인 연동하러 가기 | `/login` · `/mypage` |
| Password reset | 로그인으로 돌아가기 | `/login` |
| Home | 히어로 바로 시청하기 · 지금 뜨는 영상 · 랭킹 · 현재 라이브 방송 | `/live` (live detail route pending) |
| Home | 인기 크리에이터 | 크리에이터 프로필 popup 688:646 → 후원하기 `/creators/[id]?tab=donation` |
| Home | 첫 방문 공지 | notice carousel 200:115 · 200:223 (오늘 하루 열지 않음 · 닫기) |
| Home | 인기 크리에이터 전체보기 | `/creators` |
| Home | 이벤트 배너 지금 참여하기 | `/events` (code-first) — 보관함 기능은 없음 (2026-10-04 결정, 버튼 삭제) |
| Footer | 이용약관 · 개인정보처리방침 · 청소년보호정책 · 운영정책 | `/terms/{service,privacy,youth,operation}` |
| Footer | 고객지원 links | `/support` |
| Footer | 회사소개 links · SNS icons | plain text — destinations TBD |
| Live tabs | 인기라이브 · 전체라이브 | `/live/popular` · `/live` |
| Side nav (live) | 홈 · 추천 라이브 · 실시간 인기 급상승 | `/` · `/live` · `/live/popular` |
| Side nav | SOOP 후원 · FlexTV 후원 · 후원 내역 · FN Wallet | `/donation/soop` · `/donation/flextv` · `/donation/history` · `/wallet` |
| FN Wallet | + FN 충전 · FN 내역 자세히 보기 | charge modal · `/wallet/charges` |
| Platform donation | 검색 · 후원하기 (row) · 후원 내역 (보기) · FN 충전 | `/donation/[platform]/search?q=` · `/donation/[platform]/[creatorId]` · `/donation/history` (home: `?tab=<platform>`) · charge modal |
| Side nav | 즐겨찾기 | `/favorites` |
| Side nav | FN 내역 | `/wallet/charges` |
| Side nav | FN 충전 · 모바일에서 충전 (QR코드) | charge modal 595:1869 · QR popup 587:147 (QR target TBD) |
| Side nav | 출석체크 | `/attendance` |
| Side nav | 시청 기록 · 설정 | not wired — screens pending |
| Side nav (live) | 로그인 (guest card) · 마이페이지 | `/login` · `/mypage` |
| Creators | 카테고리 탭 · 검색 · 정렬 · 페이지 | `/creators?category=&q=&sort=&page=` |
| Creators | 크리에이터 카드 | `/creators/[id]` |
| Favorites | 크리에이터 이름 · 후원하기 | `/creators/[id]` · `/creators/[id]?tab=donation` |
| Creator room | 즐겨찾기 · 공유 · 채팅 탭 · 😊 | favorite server action · share modal (네이버 · 텔레그램 · X + 링크 복사; 826:387의 카카오톡은 앱 키가 생길 때까지 숨김, 2026-10-06) · local chat echo · 이모지 고르기 (D-CHAT-emoji `197:9523`) |
| Creator room | 후원하기 | 확인 → 완료 popups (donation server action) · FN 부족 → charge modal |
| FN 내역 | 충전 내역 · 후원 내역 탭 · 마이페이지 breadcrumb | `/wallet/charges` · `/wallet/donations` · `/mypage` |
| FN 내역 | CSV 다운로드 | `/api/wallet/charges` · `/api/wallet/donations` (session required) |
| FN 내역 | FN 충전 | charge modal (595:1869 · 595:5475 · 601:839 · 606:540 · 739:*) |
| FN 충전 약관 동의 (595:5475) | 보기 › | 개인정보 → `/terms/privacy` · 결제 · 환불 → `/terms/service` · 마케팅 → `/terms/marketing` (새 탭); 법정대리인 동의는 문서 TBD로 비활성 |
| FN 내역 | 매출전표 영수증 | not wired — payment provider pending |
| Hall of fame | 기간 탭 | `/hall-of-fame?period=` |
| Hall of fame | 나도 서포터 되기 | `/creators` (2026-10-04 결정) |
| My page | 랭킹 노출 · 마케팅 동의 토글 | saved via account service (mock) |
| My page | 사진 변경 · 닉네임/ID 수정 · 비밀번호 변경 | modals 743:1955 · 743:1997 · 743:2040 · 743:2084 (server actions, mock) |
| My page | 로그인 연동 관리 · 인증하기 · 플랫폼 연결/해제 | modals 743:2133–2227 · 743:2274 + 750:* · 743:2442 · 743:2488 (mock hand-offs, TBD) |
| My page | FN 내역 | `/wallet/charges` |
| My page | FN 충전 | charge modal |
| My page | 회원 탈퇴 | `/mypage/withdraw` (2026-10-04 · 10-05 결정: 남은 FN · 정산 대기 수익 소멸 동의 + 비밀번호 확인 후 탈퇴, 바로 재가입 가능) |
| Support | 자주 묻는 질문 바로가기 · 비밀번호 FAQ | `#faq` · `/password-reset` |
| Support | 문의하기 · 가이드 보기 | not wired — screens pending |
