# 현재 구현 Figma 파일 (2026-09-30)

Figma: [Somnation — 현재 구현 (2026-09)](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj) · FLEX_ENM 팀

코드로 구현된 사이트 전체 화면을 localhost mock 데이터로 1440px 전체 페이지 캡처해 정리한 파일이에요. 프레임은 **참고용 이미지**이고 편집 가능한 디자인 레이어가 아니에요. 원본 디자인 파일(펀페이, `PXOl6e2HQVWsu9qx9iagJV`)은 바꾸지 않았어요 (잠시 추가했던 "코드 우선 화면" 페이지는 삭제).

- 페이지: 0 README · 1 사이트 · 둘러보기 · 2 채널 · 후원 · 3 마이 · 지갑 · 4 스튜디오 · 5 인증 · 약관 · OBS · 6 어드민 · 7 디자인 · Foundations · 8 디자인 · Components · 9 레이아웃 · 스튜디오 · 10 레이아웃 · 사이트
- 1–6은 화면 캡처(이미지)예요. 편집 가능한 레이아웃은 7–9 페이지에 단계적으로 만들어요 — [site-design-system.md](site-design-system.md).
- 프레임 이름: `[ID] 화면명`, 위 캡션: 라우트
- 캡처 방법: headless Chrome + mock 세션 쿠키 (개발용 스크립트), 같은 ID로 다시 캡처해 이미지를 바꾸면 돼요
- 다시 그린(편집 가능한) 화면이 생기면 아래 표에 그 프레임 id를 적어 주세요

## 1 사이트 · 둘러보기

| ID | 화면 | 라우트 | Figma |
|---|---|---|---|
| S01-home | 홈 (funnation 구성) | `/` | [2:5](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-5) |
| S02-home-light | 홈 — 라이트 테마 | `/` | [2:8](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-8) |
| S00-home-popup | 홈 공지 팝업 | `/` | [2:11](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-11) |
| S03-bell | 헤더 알림 팝오버 | `/` | [2:15](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-15) |
| S04-notifications | 알림 /notifications | `/notifications` | [2:18](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-18) |
| S05-creators | 크리에이터 찾기 /creators | `/creators` | [2:22](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-22) |
| S06-live | 전체 방송 /live | `/live` | [2:25](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-25) |
| S06b-live-popular | 인기 방송 /live/popular | `/live/popular` | [2:28](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-28) |
| S07-hof | 명예의 전당 /hall-of-fame | `/hall-of-fame` | [2:32](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-32) |
| S08-community | 커뮤니티 /community | `/community` | [2:35](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-35) |
| S08b-post | 커뮤니티 글 상세 | `/community/p-1` | [2:38](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-38) |
| S09-community-new | 커뮤니티 글쓰기 | `/community/new` | [2:41](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-41) |
| S10-events | 이벤트 /events | `/events` | [2:44](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-44) |
| S10b-event | 이벤트 상세 | `/events/ev-first-donation` | [2:47](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-47) |
| S11-support | 고객센터 /support | `/support` | [2:51](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-51) |
| S12-notice | 공지 상세 | `/support/notices/brand` | [2:54](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-54) |

## 2 채널 · 후원

| ID | 화면 | 라우트 | Figma |
|---|---|---|---|
| C01-home | 채널 홈 + 월간 랭킹 · 커뮤니티 | `/creators/c1` | [2:58](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-58) |
| C02-crew | 크루 탭 | `/creators/c4?view=crew` | [2:61](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-61) |
| C03-videos | 영상 탭 | `/creators/c1?view=videos` | [2:64](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-64) |
| C04-community | 커뮤니티 탭 | `/creators/c1?view=community` | [2:67](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-67) |
| C05-signatures | 시그니처 탭 | `/creators/c1?view=signatures` | [2:70](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-70) |
| C06-about | 소개 탭 | `/creators/c1?view=about` | [2:73](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-73) |
| D-TEXT | 후원 패널 · 일반 | `/creators/c1?tab=donation` | [2:77](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-77) |
| D-MINI | 후원 패널 · 미니 | `/creators/c1?tab=donation` | [2:80](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-80) |
| D-VIDEO | 후원 패널 · 영상 | `/creators/c1?tab=donation` | [2:83](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-83) |
| D-SIGNATURE | 후원 패널 · 시그니처 | `/creators/c1?tab=donation` | [2:86](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-86) |
| D-WISHLIST | 후원 패널 · 위시 | `/creators/c1?tab=donation` | [2:89](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-89) |
| D-LUCKYBOX | 후원 패널 · 럭키박스 | `/creators/c1?tab=donation` | [2:92](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-92) |
| D-ROULETTE | 후원 패널 · 룰렛 | `/creators/c1?tab=donation` | [2:95](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-95) |
| D-QUEST | 후원 패널 · 퀘스트 | `/creators/c1?tab=donation` | [2:98](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-98) |
| D-DRAWING | 후원 패널 · 그림 | `/creators/c1?tab=donation` | [2:101](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-101) |
| D-QUIZ_CHOICE | 후원 패널 · 객관식 | `/creators/c1?tab=donation` | [2:104](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-104) |
| D-QUIZ_INITIAL | 후원 패널 · 초성 | `/creators/c1?tab=donation` | [2:107](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-107) |
| D-QUIZ_DRAWING | 후원 패널 · 그림퀴즈 | `/creators/c1?tab=donation` | [2:110](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-110) |
| D-crew-member | 후원 패널 · 크루 멤버 지정 | `/creators/c4?tab=donation` | [2:113](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-113) |
| P01-soop | SOOP 후원 /donation/soop | `/donation/soop` | [2:117](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-117) |
| P02-flextv | FlexTV 후원 /donation/flextv | `/donation/flextv` | [2:120](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-120) |
| P03-search | 플랫폼 크리에이터 검색 | `/donation/soop/search` | [2:123](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-123) |
| P04-creator | 플랫폼 크리에이터 후원 | `/donation/soop/kim_stream` | [2:126](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-126) |
| P05-history | 플랫폼 후원 내역 | `/donation/history` | [2:129](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-129) |

## 3 마이 · 지갑

| ID | 화면 | 라우트 | Figma |
|---|---|---|---|
| M01-mypage | 마이페이지 | `/mypage` | [2:133](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-133) |
| M02-titles | 칭호·등급 | `/mypage/titles` | [2:136](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-136) |
| M03-nicknames | 별명 관리 | `/mypage/nicknames` | [2:139](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-139) |
| M04-ranking | 내 후원 랭킹 | `/mypage/ranking` | [2:142](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-142) |
| M06-messages | 쪽지 | `/messages` | [2:145](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-145) |
| M07-favorites | 즐겨찾기 | `/favorites` | [2:148](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-148) |
| M09-attendance | 출석체크 | `/attendance` | [2:151](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-151) |
| M05-wallet | FN Wallet | `/wallet` | [2:155](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-155) |
| M05b-charge | FN 충전 | `/wallet` | [2:158](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-158) |
| M05c-charges | 충전 내역 | `/wallet/charges` | [2:161](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-161) |
| M05d-donations | 후원 내역 | `/wallet/donations` | [2:164](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-164) |

## 4 스튜디오

2026-10-02: C01 통합 채팅 추가, W03 오버레이 주소 · W11 후원 연동 다시 캡처(채팅 그룹 · 모든 플랫폼 테스트 후원).

| ID | 화면 | 라우트 | Figma |
|---|---|---|---|
| T01-dashboard | 대시보드 /creator | `/creator` | [2:168](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-168) |
| T02-revenue | 수익 현황 | `/creator/revenue` | [2:171](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-171) |
| T02b-ranking | 크리에이터 랭킹 | `/creator/ranking` | [2:174](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-174) |
| T05-updates | 업데이트 소식 | `/creator/updates` | [2:177](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-177) |
| H01-settings | 채널 설정 | `/creator/settings` | [2:181](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-181) |
| H02-donation-settings | 후원 페이지 설정 | `/creator/donations?tab=settings` | [2:184](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-184) |
| H03-titles | 칭호 관리 | `/creator/donations?tab=titles` | [2:187](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-187) |
| Y01-youtube | 유튜브 연동 | `/creator/youtube` | [2:190](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-190) |
| Y02-videos | 영상 목록 | `/creator/videos` | [2:193](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-193) |
| W01-widgets | 위젯 목록 (funnation 구성) | `/creator/widgets` | [2:197](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-197) |
| W02-tools | 방송 도구 | `/creator/widgets/tools` | [2:200](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-200) |
| W03-overlays | 오버레이 주소 | `/creator/widgets/overlays` | [2:203](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-203) |
| W04-remote | 리모컨 | `/creator/remote` | [2:206](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-206) |
| W05-effects | 이펙트 · 효과 | `/creator/widgets/effects` | [2:209](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-209) |
| W06-signatures | 시그니처 후원 (편집 열림) | `/creator/widgets/signatures` | [2:212](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-212) |
| W07-video | 영상 후원 | `/creator/widgets/video` | [2:215](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-215) |
| W08-drawing | 그림후원 | `/creator/widgets/drawing` | [2:218](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-218) |
| W09-assets | 이미지·사운드 | `/creator/widgets/assets` | [2:221](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-221) |
| W10-banner | 배너 | `/creator/widgets/banner` | [2:224](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-224) |
| W11-link | 후원 연동 | `/creator/widgets/link` | [2:227](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-227) |
| C01-chat | 통합 채팅 (YouTube · 치지직 · SOOP · FlexTV) | `/creator/chat` | [41:4](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=41-4) |
| Y03-crew | 크루 관리 | `/creator/crew` | [2:231](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-231) |
| Y04-broadcast | 크루 방송 운영 | `/creator/crew/broadcast` | [2:234](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-234) |
| T03-donations | 받은 후원 (CSV) | `/creator/donations?tab=list` | [2:238](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-238) |
| T03b-ranking | 후원 순위 | `/creator/donations?tab=ranking` | [2:241](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-241) |
| T03c-filtering | 후원 필터링 | `/creator/donations?tab=filtering` | [2:244](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-244) |
| T04-settlement | 정산 현황 + 체크리스트 | `/creator/settlement` | [2:248](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-248) |
| T04b-register | 정산 인증·등록 | `/creator/settlement/register` | [2:251](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-251) |
| T04c-form | 정산 자료 등록 | `/creator/settlement/register/form` | [2:254](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-254) |
| T04d-apply | 정산 신청 | `/creator/settlement/apply` | [2:257](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-257) |
| T04e-manage | 정산 관리 | `/creator/settlement/manage` | [2:260](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-260) |

## 5 인증 · 약관 · OBS

| ID | 화면 | 라우트 | Figma |
|---|---|---|---|
| A01-login | 로그인 | `/login` | [2:264](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-264) |
| A02-login-creator | 로그인 (크리에이터) | `/login?role=creator` | [2:267](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-267) |
| A03-signup | 회원가입 | `/signup` | [2:270](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-270) |
| A04-password-reset | 비밀번호 재설정 | `/password-reset` | [2:273](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-273) |
| A05-password-change | 비밀번호 변경 | `/login/password-change` | [2:276](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-276) |
| A06-home-guest | 홈 (비로그인) | `/` | [2:279](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-279) |
| L01-terms-service | 서비스 이용약관 | `/terms/service` | [2:283](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-283) |
| L02-terms-privacy | 개인정보 처리방침 | `/terms/privacy` | [2:286](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-286) |
| O01-drawing | 그림후원 오버레이 (800×700) | `/overlay/drawing/[key]` | [2:290](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-290) |
| O02-banner | 배너 오버레이 (1920×1080) | `/overlay/banner/[key]` | [2:293](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-293) |
| O03-crew | 크루 점수판 오버레이 (480×600) | `/overlay/crew/[key]` | [2:296](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=2-296) |
| O04-chat | 통합 채팅 오버레이 (400×600) | `/overlay/chat/[key]` | [41:7](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=41-7) |

## 6 어드민 (별도 앱 apps/admin · admin 서브도메인)

2026-10-01 추가. 라우트는 어드민 앱 기준(admin.<도메인>)이에요.
어드민 디자인 원본은 별도 파일 **Somnation Admin**이에요 ([admin-design-system.md](admin-design-system.md)). 이 페이지의 캡처는 2026-10-01 어드민 전용 디자인 적용 후 다시 찍었어요 (노드 ID는 그대로).

| ID | 화면 | 라우트 | Figma |
|---|---|---|---|
| AD01-login | 로그인 | `/login` | [19:7](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=19-7) |
| AD02-dashboard | 운영 대시보드 | `/` | [19:10](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=19-10) |
| AD03-audit | 감사 로그 | `/audit` | [19:13](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=19-13) |
| AD04-members | 회원 관리 | `/members` | [19:17](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=19-17) |
| AD05-member | 회원 상세 · 이용 제한 | `/members/[id]` | [19:20](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=19-20) |
| AD06-creators | 크리에이터 관리 | `/creators` | [19:23](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=19-23) |
| AD07-payments | 결제 · 충전 내역 | `/payments` | [19:27](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=19-27) |
| AD08-refunds | 환불 요청 | `/payments?tab=refunds` | [19:30](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=19-30) |
| AD09-donations | 후원 운영 | `/donations` | [19:33](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=19-33) |
| AD10-settlements | 정산 심사 | `/settlements` | [19:36](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=19-36) |
| AD11-reports | 신고 처리 | `/reports` | [19:40](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=19-40) |
| AD12-content | 콘텐츠 관리 · 공지 | `/content` | [19:43](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=19-43) |
| AD13-faq | 콘텐츠 관리 · FAQ | `/content?tab=faq` | [19:46](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=19-46) |
| AD14-platforms | 플랫폼 연동 | `/platforms` | [19:49](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=19-49) |
| AD15-system | 시스템 · 공지 배너 | `/system` | [19:52](https://www.figma.com/design/PMnjPwrD3nAiItJxjaZ0qj?node-id=19-52) |
