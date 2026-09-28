# Route ↔ Figma map

Status: ✅ implemented · 🚧 placeholder (link works, screen pending)

| Route | Status | Figma frames |
|---|---|---|
| `/` | 🚧 | funnation-videos-page 727:2742 (candidate) |
| `/login` | ✅ | 13:7 · 718:123 · 718:168 · 718:213 |
| `/signup` | ✅ | 280:56 · 13:63 · 722:473 · 722:536 · 722:599 · 45:39 · 722:692–722:1059 · 723:183 |
| `/password-reset` | ✅ | 13:179 · 718:626 · 718:582 · 720:18 · 720:60 · 720:103 · 718:244 |
| `/live` | 🚧 | 617:316 · 617:5 |
| `/creators` | 🚧 | 4:7 · 690:5 |
| `/hall-of-fame` | 🚧 | 3:637 |
| `/support` | 🚧 | — (no screen yet) |
| `/mypage` | 🚧 | 622:4 · 735:4119 |
| `/terms/[slug]` | 🚧 | 722:3 (terms text pending) |

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
