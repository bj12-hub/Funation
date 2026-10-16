# 후원 내역 이관 (Donation history import)

Code-first (no Figma frame), 2026-10-16 request: "펀네이션처럼 투네이션에서 후원 내역을 CSV 파일로 받아서 업로드하는 기능을
썸네이션도 동일하게, 그리고 FlexTV의 후원 내역은 계정 연동하는 방식으로." funnation reference: "투네이션 후원 내역 이관하기"
(`docs/research/funnation-reference.md`).

Route: `/creator/donations?tab=import` (후원관리+ › 내역 이관), sub-view `&sub=records` (가져온 내역). Role: Creator.
Code: `apps/web/src/services/creator/donationImport*.ts`, `features/creatorStudio/donations/ImportTab.tsx` and the cards next
to it; FlexTV history in `services/platforms/adapters.ts` (`DONATION_HISTORY`) and `mockHistoryRemote.ts`.

## Scope — 기본값 (TBD)

The user did not answer the scope questions. These defaults are built and are **pending the user's confirmation**
(`docs/product/open-decisions.md`):

| Question | 기본값 (TBD) |
|---|---|
| Who imports what | The creator imports donations they **received** on 투네이션 / FlexTV (a creator moving to Ssumnation keeps their donor history). |
| Where they show | 후원관리+ › 내역 이관 › 가져온 내역, with their source (투네이션 · FlexTV). Only the creator sees them. |
| Where they count | 수단별 보드 only: rows of their own ("투네이션 이관 · 3건", "FlexTV 이관 · 45건") in their original unit, 원, by the time they were donated. Sums only — no names. |
| Where they never count | 회원 누적 / 활동 등급, 크리에이터 칭호, FN 후원자 랭킹 (후원랭킹 위젯 · 채널 월간 순위 · 내 랭킹 · 명예의 전당), 후원 리스트 and its totals, dashboard, 수익, 정산. |
| Money | Imported records never move FN and create no wallet, earnings or settlement record. |
| Matching donors | Nicknames are not matched to Ssumnation members (TBD). |
| KRW ↔ FN | No rate (TBD); amounts stay in 원. |
| FlexTV unlink | Imported FlexTV records **stay**; the creator removes them with 되돌리기 per sync batch. |

## 투네이션 CSV

### Assumed format (TBD — no real 투네이션 export sample exists)

- One header row; up to 4 title lines above it are skipped (the first of the first 5 rows that names every required column).
- One donation per row. Columns are found by header name (`donationImportCsv.ts` `ALIASES`, exact names first, then keywords):

  | Field | Required | Header names (normalized: spaces, `_ - . :` and anything in brackets removed, lowercase) |
  |---|---|---|
  | 후원 일시 | ✓ | 후원일시 · 일시 · 날짜 · 후원날짜 · 후원일 · 일자 · 시간 · 후원시간 · 결제일시 · 결제일 · date · time · datetime · timestamp · createdat · donatedat · donationdate · donationtime; keyword 일시 · 날짜 · date · time |
  | 후원자 닉네임 | ✓ | 닉네임 · 후원자 · 후원자닉네임 · 후원자명 · 후원닉네임 · 후원자이름 · 보낸사람 · 보낸이 · 이름 · name · nickname · nick · donor · donorname · sender · username; keyword 닉네임 · nickname (never an 아이디 / id column) |
  | 금액(원) | ✓ | 금액 · 후원금액 · 후원액 · 캐시 · 후원캐시 · 결제금액 · amount · cash · price · donationamount; keyword 금액 · amount |
  | 메시지 | | 메시지 · 메세지 · 후원메시지 · 후원메세지 · 내용 · 후원내용 · 코멘트 · comment · message · msg · text · content |
  | 유형 | | 유형 · 후원유형 · 종류 · 후원종류 · 구분 · type · kind · category · donationtype |

- When a required column is not found, the preview shows the first rows as they are and the creator picks the columns.
- Time: Korea time unless the value has a zone. Read: `2026-10-16 15:04:05` · `2026-10-16T15:04` · `2026.10.16 15:04` ·
  `2026/10/16 3:04 PM` · `2026. 10. 16. 오후 3:04:05` · `2026년 10월 16일 15:04` · `2026-10-16` (00:00) · ISO with `Z` / `+09:00`.
  Not read (BAD_DATE): spreadsheet serial numbers, day-first dates, years before 2000. More than 10 minutes in the future: FUTURE_DATE.
- Amount: whole 원 — `1000` · `1,000` · `1,000원` · `₩1,000` · `1000.00`. `-1000` / `0` NON_POSITIVE, `1.5` and `1.000` NON_INTEGER
  (not guessed), more than 10,000,000 원 per row AMOUNT_TOO_LARGE (sanity bound like the platform adapters', not a business rule).
- Nickname: required, controls and bidi overrides removed, cut at 40 characters. Message: line breaks kept, cut at 500.
  유형: cut at 20, shown only (whether 취소 / 환불 rows of an export should be skipped is TBD).
- Delimiter: comma, or tab / semicolon when the first line clearly uses them; Excel's `sep=;` line is honoured.

### Encodings

UTF-8 (with or without BOM), UTF-16 with a BOM (엑셀 "유니코드 텍스트"), and **CP949** (엑셀 "CSV (쉼표로 분리)" on Korean
Windows). Node's `euc-kr` decoder covers KS X 1001 only and silently misreads the 8,822 UHC syllables (e.g. 똠 = `8C 63`); the
reader derives the UHC table from the KS X 1001 one (UHC lists the missing Hangul syllables in Unicode order — checked against
Windows' CP949 for all 11,172 syllables). Anything else is refused ("글자를 읽을 수 없어요…").

### Limits (sample values — TBD)

| | |
|---|---|
| File | 5 MB, `.csv` (also `.txt` · `.tsv`); an `.xlsx` / `.xls` (or one renamed `.csv`) is refused with "CSV로 저장한 뒤" |
| Rows | 20,000 data rows per file |
| Columns | 50 per row |
| Preview | the first 20 rows, up to 100 rows it will skip; kept on the server 30 minutes, 3 per creator |

### Flow

1. **Upload** (`previewToonationCsv`, FormData `file`): the server reads, decodes and parses the file and stores the rows under a
   preview id (owner + account). Nothing is imported.
2. **Preview**: 가져올 내역 · 전체 행 · 합계 원 · 오류 · 중복 (파일 안 · 이미 가져옴), the first rows with their status, every skipped
   row with its reason. Columns can be changed (`remapToonationCsv`).
3. **Import** (`importToonationCsv`, `requestId`): the rows are evaluated again and written as one batch in one synchronous step
   after the last await, for the account the request started with. A retry with the same request id gets the first result; the
   same id with another preview or column choice is CONFLICT; one still running is IN_PROGRESS.
4. **Duplicates**: fingerprint = SHA-256 of source · time · nickname · amount · SHA-256(message). A repeat inside the file is
   skipped (TBD: two identical donations in the same second would count once), and so is a row already imported (active batches).
5. **되돌리기** (`undoDonationImport`): confirm step, then the batch's records are removed for good; the batch stays as 되돌림
   (counts only). Idempotent. A file whose batch was undone can be imported again.

## FlexTV — 계정 연동

- The FlexTV account is the one linked for 통합 채팅 · 후원 연동 (`channelsCore`). Not linked → "FlexTV 계정 연동" on the card
  runs the same mock connect (`connectBroadcastChannel`, channel id; no real OAuth or keys).
- Adapter capability **DONATION_HISTORY** (FlexTV only, declared as unverified → 「API 확인 중」): `fetchReceivedDonations(channel,
  { cursor, since })` returns pages of `ExternalReceivedDonation` (oldest first, opaque cursor). The mock FlexTV DTO (`giftNo ·
  sender · price · currency · memo · giftedAt`) is mapped in the adapter; malformed items are dropped and counted (`skipped`).
  Amounts with `currency: "KRW"` are 원; anything else keeps FlexTV's placeholder unit `FLEXTV_UNIT` (unit TBD).
- **FlexTV 내역 가져오기** (`syncFlexTvDonations`): reads after the stored cursor (per channel — another channel starts from the
  beginning of its own history), up to 10 pages (sample value; "남은 내역이 있어요" and the next press continues), and imports what
  is new by **External Transaction ID**. Result: "n건 새로 가져옴 · n건 이미 있음 (· 읽을 수 없는 n건 건너뜀)". One sync at a time.
- Failures: not linked (NOT_LINKED), API failure / timeout (5 s) → FAILED with the reason and 다시 시도 — pages read before the
  failure are kept with their position; unsupported capability (UNSUPPORTED); the link changed during the read (CHANNEL_CHANGED,
  nothing written). The last sync time, result and error show on the card.
- 되돌리기 of a sync batch keeps the read position, so the removed records are not taken again by the next sync (TBD: a "처음부터
  다시 가져오기").
- TBD: the real API (paging, how far back the first sync goes — `since` is passed as null, rate limits, auth), whether its
  transaction ids equal the 후원 연동 event ids (a donation seen live by 후원 연동 and imported from history would show in both the
  live FlexTV row and the "FlexTV 이관" row of the 수단별 보드), FlexTV's unit.

## Security and privacy

- The file is parsed on the server; its content is data, never executed. Screens render it as text (React escapes it).
- Every action needs the Creator role: a supporter, a signed-out visitor, a suspended or a withdrawn creator gets UNAUTHORIZED /
  nothing (`getCreatorSession` is null for them). Lookups by client-sent ids use own-property checks.
- 가져온 내역 CSV 다운로드 escapes cells a spreadsheet would run as a formula (`= + - @` tab CR → leading `'`, `lib/csv.ts`).
- Donor nicknames and messages are third-party personal data: kept only for this creator, shown only on the creator's 내역 이관
  screens. They never reach public pages, the hall of fame, OBS overlays or the 수단별 보드 (which gets source · unit · amount · time).
  On-screen notice: "가져온 내역에는 후원자 닉네임 · 메시지가 들어 있어요. 스튜디오에서 나만 볼 수 있고, 채널 페이지 · 명예의 전당 ·
  방송 화면에는 보이지 않아요."
- **Retention (TBD)**: kept until the creator removes them (되돌리기) or withdraws; no period while the account is active yet. 회원
  탈퇴 deletes the records, batches, waiting previews and the FlexTV read position (`withdrawal.ts` → `clearDonationImports`); the
  trail (who · when · action · count, no donor data) stays. A suspended creator's records stay for after the suspension.
- Audit: the store keeps an append-only trail (CSV_IMPORT · FLEXTV_SYNC · UNDO with actor and count). The backend's audit store is TBD.
- TBD with the backend: per-creator storage (the mock has one creator), a cap on stored records per creator, upload rate limits.

## 도우미 host

Not served there. The 도우미 is the OBS 송출 · 리모컨 product (2026-10-14 결정, `docs/development/helper-domain.md`); 내역 이관 is
studio data, so `/creator/donations?tab=import` on the 도우미 host goes to the 도우미 home like the other studio pages it does not
have. The actions check the session and role only, never the host.
