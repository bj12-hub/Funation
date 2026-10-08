# Supporter grades and titles (후원자 등급 · 칭호)

Code-first (no Figma frame): `services/supporter/identityTypes.ts` (ladders), `identityCore.ts` (computation),
screens `/mypage/titles`, `/mypage` (활동 등급 card), `/hall-of-fame` (칭호 갤러리), and the badges on donation
alerts and the donation confirm preview.

## Structure (2026-10-08)

Product decision (2026-10-08): apply the FLEXTV 회원 등급 개편안 (two axes, like Toonation) to Ssumnation. A supporter has
both at once, e.g. `레드 다이아 · 플래티넘`, plus the per-creator title (크리에이터 칭호, unchanged).

| Axis | Ladder | Counts | Moves |
|---|---|---|---|
| 누적 등급 (global title) | 다이아 · 블루 · 그린 · 레드 · 퍼플 · 레인보우 다이아, 블랙 1성 ~ 6성 (12) | every completed donation | only up |
| 활동 등급 (grade) | 일반 (base, never a badge) · 실버 · 골드 · 플래티넘 · 마스터 · 레전드 | this month and the five before | up at once, down only on the 1st |

**Thresholds are placeholders (TBD).** The FN numbers are the plan's 렉스 numbers as they are (user choice
2026-10-08: "렉스 숫자 그대로"), because the FN exchange rate is still TBD: 실버 30,000 · 골드 60,000 · 플래티넘
100,000 · 마스터 200,000 · 레전드 500,000 FN; 다이아 500,000 → 레인보우 다이아 3,300,000 FN; 블랙 1성 5,000,000 →
6성 15,000,000 FN. Below 다이아 there is no 누적 등급; small supporters show the 활동 등급 and the 크리에이터 칭호.

## 활동 등급 rule

Calendar months in server time (Asia/Seoul), as in [`lib/period.ts`](../../apps/web/src/lib/period.ts):

- `recentFn` = completed donations from the 1st of the month five months back until now.
- On the 1st the grade is set from the six full months before this month, and holds until the month ends.
- The shown grade is the higher of the two; a donation that reaches a higher grade raises it at once.
- When the held grade is above what `recentFn` alone gives, the screens say "이번 달 말까지 유지" and the progress bar
  to the next grade counts from the held grade (empty, never negative).

Only `COMPLETED` donations count: a 퀘스트 counts once it succeeds, a refunded or failed one never does (dated by when it
was sent, as before). A 재가입 account starts without the withdrawn account's donations, so without its grade or titles.

## Still TBD

- FN thresholds (with the FN exchange rate), and whether the 원화 notice amounts of FLEXTV carry over.
- Benefits per grade (첫 달성 선물, 전용 이벤트 …) — none are implemented.
- Whether long-time supporters below 다이아 should get an entry 누적 등급.
