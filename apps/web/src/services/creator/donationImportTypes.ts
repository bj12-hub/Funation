import { formatNumber } from "@/lib/format";
import type { PlatformErrorCode } from "@/services/platforms/platformTypes";
import { formatUnitAmount, type AmountUnit } from "@/types/donationUnit";

/**
 * 다른 플랫폼 후원 내역 이관 — code-first (no Figma frame; funnation "투네이션 후원 내역 이관하기"), route
 * `/creator/donations?tab=import`. Client-safe types, limits and copy; the actions live in ./donationImport.ts, the store
 * in ./donationImportCore.ts, the CSV reader in ./donationImportCsv.ts. docs/domains/donation-import.md.
 *
 * 기본값 (TBD — 2026-10-16 request, the scope questions are not answered yet):
 * - The creator imports donations they RECEIVED elsewhere: 투네이션 as a CSV file, FlexTV through the linked account.
 * - Imported records are listed with their source in 후원관리+ › 내역 이관 › 가져온 내역 and add rows of their own, in 원,
 *   to the 수단별 보드. Nothing else reads them: no 회원 누적/활동 등급, 크리에이터 칭호, FN 후원자 랭킹, 수익 or 정산, no
 *   FN, wallet or earnings record. Matching donor nicknames to Ssumnation members and a KRW ↔ FN rate are TBD.
 */

/** `?tab=import&sub=`: 가져오기 (upload · FlexTV · 가져온 기록) and 가져온 내역 (the records). */
export const IMPORT_SUBTABS = [
  { key: "upload", label: "가져오기" },
  { key: "records", label: "가져온 내역" }
] as const;
export type ImportSubtab = (typeof IMPORT_SUBTABS)[number]["key"];

export const IMPORT_SOURCES = ["TOONATION", "FLEXTV"] as const;
export type ImportSource = (typeof IMPORT_SOURCES)[number];
export const IMPORT_SOURCE_LABEL: Record<ImportSource, string> = { TOONATION: "투네이션", FLEXTV: "FlexTV" };

// ── Limits (sample values — TBD) ─────────────────────────────────────────────────────────────────────────────

/** One CSV file: 5 MB (sample value). */
export const CSV_MAX_BYTES = 5 * 1024 * 1024;
/** Data rows in one file (sample value). */
export const CSV_MAX_ROWS = 20_000;
/** Columns in one row — a guard against files that are not a donation export. */
export const CSV_MAX_COLUMNS = 50;
/** The header must be within the first rows (title lines above it are skipped). */
export const CSV_HEADER_SCAN_ROWS = 5;
/** Stored lengths: longer text is cut (sample values). */
export const IMPORT_NICKNAME_MAX = 40;
export const IMPORT_MESSAGE_MAX = 500;
export const IMPORT_TYPE_MAX = 20;
export const IMPORT_FILE_NAME_MAX = 100;
/** One donation, in 원 — a sanity bound like the platform adapters' (10,000,000), not a business rule. */
export const IMPORT_AMOUNT_MAX = 10_000_000;
/** Rows the preview shows from the top of the file, and problem rows it lists. */
export const IMPORT_PREVIEW_ROWS = 20;
export const IMPORT_PROBLEM_ROWS = 100;
/** A preview can be imported for 30 minutes (sample value); the file is read again after that. */
export const PREVIEW_TTL_MS = 30 * 60_000;
/** FlexTV pages per "FlexTV 내역 가져오기" (sample value); the rest on the next press. */
export const FLEXTV_SYNC_MAX_PAGES = 10;
/** 가져온 내역 page size and its CSV export cap (sample values). */
export const IMPORTED_PAGE_SIZE = 20;
export const IMPORTED_EXPORT_MAX = 20_000;
export const IMPORTED_QUERY_MAX = 20;

// ── Columns ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The columns a 투네이션 export is assumed to have (no real export sample exists — TBD). Detected by header name; the
 * creator picks them by hand when detection fails. `message` and `type` are optional.
 */
export const IMPORT_FIELDS = [
  { key: "at", label: "후원 일시", required: true },
  { key: "nickname", label: "후원자 닉네임", required: true },
  { key: "amount", label: "금액(원)", required: true },
  { key: "message", label: "메시지", required: false },
  { key: "type", label: "유형", required: false }
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number]["key"];
/** Column index per field (0-based), or null when the file has no such column. */
export type ColumnMapping = Record<ImportField, number | null>;
export const EMPTY_MAPPING: ColumnMapping = { at: null, nickname: null, amount: null, message: null, type: null };

/** A file in the assumed format, offered as "예시 파일 받기" (fictional donors). */
export const SAMPLE_CSV = [
  "후원일시,닉네임,금액,메시지,유형",
  '2026-09-01 20:15:03,별빛소나기,"1,000",오늘 방송 재밌어요!,후원',
  '2026-09-01 20:40:11,새벽라디오,"10,000","노래 한 곡 부탁해요',
  '두 줄 메시지도 괜찮아요",후원',
  "2026-09-02 21:05:47,콩떡이,5000,,후원"
].join("\r\n");

// ── Preview ─────────────────────────────────────────────────────────────────────────────────────────────────

export type RowErrorCode = "BAD_DATE" | "FUTURE_DATE" | "BAD_AMOUNT" | "NON_POSITIVE_AMOUNT" | "NON_INTEGER_AMOUNT" | "AMOUNT_TOO_LARGE" | "EMPTY_NICKNAME";
export const ROW_ERROR_LABEL: Record<RowErrorCode, string> = {
  BAD_DATE: "날짜를 읽을 수 없어요",
  FUTURE_DATE: "아직 오지 않은 날짜예요",
  BAD_AMOUNT: "금액이 숫자가 아니에요",
  NON_POSITIVE_AMOUNT: "금액이 0원 이하예요",
  NON_INTEGER_AMOUNT: "금액에 소수점이 있어요",
  AMOUNT_TOO_LARGE: "한 건 금액이 너무 커요",
  EMPTY_NICKNAME: "닉네임이 비어 있어요"
};

/** OK = will be imported. DUPLICATE_IN_FILE = the same donation appears above it in this file. */
export type RowStatus = "OK" | "INVALID" | "DUPLICATE_IN_FILE" | "ALREADY_IMPORTED";
export const ROW_STATUS_LABEL: Record<RowStatus, string> = {
  OK: "가져옴",
  INVALID: "오류",
  DUPLICATE_IN_FILE: "파일 안 중복",
  ALREADY_IMPORTED: "이미 가져옴"
};

export type PreviewRow = {
  /** Row number in the file as a spreadsheet counts it (the header is a row too). */
  row: number;
  status: RowStatus;
  /** ISO instant, or null when the date could not be read. */
  at: string | null;
  nickname: string;
  /** 원, or null when the amount could not be read. */
  amount: number | null;
  message: string;
  type: string | null;
  errors: RowErrorCode[];
};

export type PreviewTotals = {
  /** Data rows under the header (empty lines are not rows). */
  rows: number;
  /** Rows that will be imported. */
  valid: number;
  invalid: number;
  duplicateInFile: number;
  alreadyImported: number;
  /** 원 of the rows that will be imported. */
  amount: number;
};

export type CsvEncoding = "UTF-8" | "CP949" | "UTF-16";

export type CsvPreview = {
  previewId: string;
  fileName: string;
  encoding: CsvEncoding;
  headers: string[];
  mapping: ColumnMapping;
  /** Required fields without a column: nothing is validated until the creator picks them. */
  missing: ImportField[];
  /** Every column was found by its header name. */
  detected: boolean;
  /** The first data rows as they are in the file, for picking columns by hand. */
  sample: string[][];
  totals: PreviewTotals;
  /** The first IMPORT_PREVIEW_ROWS data rows. */
  rows: PreviewRow[];
  /** Up to IMPORT_PROBLEM_ROWS rows that will not be imported, in file order. */
  problems: PreviewRow[];
  expiresAt: string;
};

export type CsvFileError =
  | "NO_FILE"
  | "NOT_CSV"
  | "SPREADSHEET"
  | "TOO_LARGE"
  | "EMPTY"
  | "NO_DATA"
  | "TOO_MANY_ROWS"
  | "TOO_MANY_COLUMNS"
  | "ENCODING"
  | "MALFORMED"
  | "BAD_MAPPING"
  | "BAD_REQUEST"
  | "EXPIRED";

export const CSV_FILE_ERROR_MESSAGE: Record<Exclude<CsvFileError, "MALFORMED">, string> = {
  NO_FILE: "CSV 파일을 골라 주세요.",
  NOT_CSV: "CSV 파일(.csv)만 올릴 수 있어요.",
  SPREADSHEET: "엑셀 파일(.xlsx)은 'CSV UTF-8' 또는 'CSV (쉼표로 분리)'로 저장한 뒤 올려 주세요.",
  TOO_LARGE: `파일은 ${CSV_MAX_BYTES / 1024 / 1024}MB까지 올릴 수 있어요. 기간을 나눠 내려받아 주세요.`,
  EMPTY: "파일에 내용이 없어요.",
  NO_DATA: "제목 줄 아래에 후원 내역이 없어요.",
  TOO_MANY_ROWS: `한 번에 ${formatNumber(CSV_MAX_ROWS)}행까지 올릴 수 있어요. 기간을 나눠 올려 주세요.`,
  TOO_MANY_COLUMNS: `열이 너무 많아요 (${CSV_MAX_COLUMNS}개까지). 투네이션에서 내려받은 후원 내역 파일이 맞는지 확인해 주세요.`,
  ENCODING: "글자를 읽을 수 없어요. 'CSV UTF-8' 또는 엑셀의 'CSV (쉼표로 분리)'로 저장해 주세요.",
  BAD_MAPPING: "열 선택을 확인해 주세요. 후원 일시 · 후원자 닉네임 · 금액은 꼭 골라야 하고, 한 열은 한 항목에만 고를 수 있어요.",
  BAD_REQUEST: "요청을 확인해 주세요. 화면을 새로 고친 뒤 다시 시도해 주세요.",
  EXPIRED: "미리보기 시간이 지났어요. 파일을 다시 올려 주세요."
};

export const malformedMessage = (row: number) => `${formatNumber(row)}행에서 따옴표가 닫히지 않았어요. 파일을 확인해 주세요.`;

export type CsvPreviewResult = { status: "OK"; preview: CsvPreview } | { status: "INVALID"; code: CsvFileError; message: string } | { status: "UNAUTHORIZED" };

// ── Import · undo ───────────────────────────────────────────────────────────────────────────────────────────

export type ImportBatchView = {
  id: string;
  source: ImportSource;
  createdAt: string;
  /** 투네이션: the uploaded file's name. */
  fileName: string | null;
  /** FlexTV: the linked channel at the time. */
  channelHandle: string | null;
  /** Rows in the file (투네이션) or donations FlexTV returned (FlexTV). */
  rows: number;
  imported: number;
  invalid: number;
  duplicates: number;
  /** Sum of the imported records per unit (원 for both sources in the mock). */
  totals: { unit: AmountUnit; value: number }[];
  status: "ACTIVE" | "UNDONE";
  undoneAt: string | null;
};

export type CsvImportResult =
  | { status: "IMPORTED"; batch: ImportBatchView }
  /** Every row was invalid or already imported: no batch. */
  | { status: "NOTHING_TO_IMPORT"; invalid: number; duplicates: number }
  | { status: "INVALID"; code: CsvFileError; message: string }
  /** The same request id is still being processed. */
  | { status: "IN_PROGRESS" }
  /** The same request id was used for another preview or column choice. */
  | { status: "CONFLICT" }
  | { status: "UNAUTHORIZED" };

export type UndoResult = { status: "UNDONE"; removed: number } | { status: "NOT_FOUND" } | { status: "UNAUTHORIZED" };

// ── FlexTV ──────────────────────────────────────────────────────────────────────────────────────────────────

export type FlexTvSyncCounts = { imported: number; duplicates: number; skipped: number };

export type FlexTvImportState = {
  /** The FlexTV adapter declares DONATION_HISTORY. */
  supported: boolean;
  /** Declared by the mock, not confirmed against FlexTV's real API (TBD) — shown as 「API 확인 중」. */
  unverified: boolean;
  /** The FlexTV account linked for 통합 채팅 · 후원 연동 (the same link). */
  linked: { handle: string; title: string } | null;
  /** The last sync that finished (also one that stopped part-way). */
  lastSyncAt: string | null;
  lastResult: (FlexTvSyncCounts & { hasMore: boolean }) | null;
  lastError: PlatformErrorCode | null;
};

export type FlexTvSyncResult =
  | ({ status: "OK"; hasMore: boolean; syncedAt: string } & FlexTvSyncCounts)
  /** Stopped part-way: what came before the failure is kept (counts), the rest comes on the next try. */
  | ({ status: "FAILED"; code: PlatformErrorCode | "CHANNEL_CHANGED"; message: string } & FlexTvSyncCounts)
  | { status: "NOT_LINKED" }
  | { status: "UNSUPPORTED" }
  /** Another sync is running. */
  | { status: "IN_PROGRESS" }
  | { status: "UNAUTHORIZED" };

export const FLEXTV_SYNC_ERROR: Record<PlatformErrorCode | "CHANNEL_CHANGED", string> = {
  TIMEOUT: "FlexTV 응답이 늦어요. 잠시 후 다시 시도해 주세요.",
  UNAVAILABLE: "FlexTV에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.",
  UNAUTHORIZED: "FlexTV 연결 권한이 만료됐어요. 계정을 다시 연동해 주세요.",
  NOT_FOUND: "연동한 FlexTV 채널을 찾을 수 없어요. 계정을 다시 연동해 주세요.",
  UNSUPPORTED: "FlexTV 내역 가져오기는 아직 지원하지 않아요.",
  CHANNEL_CHANGED: "가져오는 동안 FlexTV 연결이 바뀌었어요. 다시 시도해 주세요."
};

/** FlexTV sync copy, shared by the card and its tests. */
/** "12건 새로 가져옴 · 3건 이미 있음 · 읽을 수 없는 1건 건너뜀". */
export const syncCountsLine = (c: FlexTvSyncCounts) =>
  `${formatNumber(c.imported)}건 새로 가져옴 · ${formatNumber(c.duplicates)}건 이미 있음${c.skipped > 0 ? ` · 읽을 수 없는 ${formatNumber(c.skipped)}건 건너뜀` : ""}`;

/** What a sync answered, as the card shows it (also used by the tests). */
export function syncMessage(r: FlexTvSyncResult): { ok: boolean; text: string } {
  switch (r.status) {
    case "OK":
      return { ok: true, text: `${syncCountsLine(r)}${r.hasMore ? ". 남은 내역이 있어요. 한 번 더 누르면 이어서 가져와요." : ""}` };
    case "FAILED":
      return { ok: false, text: r.imported + r.duplicates + r.skipped > 0 ? `${r.message} (멈추기 전까지 ${syncCountsLine(r)})` : r.message };
    case "NOT_LINKED":
      return { ok: false, text: "FlexTV 계정을 먼저 연동해 주세요." };
    case "UNSUPPORTED":
      return { ok: false, text: FLEXTV_SYNC_ERROR.UNSUPPORTED };
    case "IN_PROGRESS":
      return { ok: false, text: "이미 가져오는 중이에요. 잠시 후 다시 확인해 주세요." };
    default:
      return { ok: false, text: "로그인이 필요합니다." };
  }
}

// ── Overview · 가져온 내역 ────────────────────────────────────────────────────────────────────────────────────

export type SourceTotal = { source: ImportSource; count: number; totals: { unit: AmountUnit; value: number }[] };

export type ImportOverview = {
  /** Newest first, undone ones included (their records are gone). */
  batches: ImportBatchView[];
  totals: SourceTotal[];
  flextv: FlexTvImportState;
};

export const IMPORTED_SOURCE_FILTERS = [
  { key: "all", label: "전체" },
  { key: "toonation", label: "투네이션" },
  { key: "flextv", label: "FlexTV" }
] as const;
export type ImportedSourceFilter = (typeof IMPORTED_SOURCE_FILTERS)[number]["key"];
export const sourceOfFilter = (f: ImportedSourceFilter): ImportSource | null => (f === "toonation" ? "TOONATION" : f === "flextv" ? "FLEXTV" : null);

export type ImportedFilter = {
  source: ImportedSourceFilter;
  /** Korean calendar days `YYYY-MM-DD`, both optional (none = every date). */
  from: string | null;
  to: string | null;
  query: string;
};

export type ImportedDonationView = {
  id: string;
  source: ImportSource;
  at: string;
  donorName: string;
  message: string;
  kind: string | null;
  amount: number;
  unit: AmountUnit;
};

export type ImportedDonationPage = ImportedFilter & {
  page: number;
  totalPages: number;
  total: number;
  items: ImportedDonationView[];
  /** Over every match (all pages), per unit. */
  totals: { unit: AmountUnit; value: number }[];
  /** The creator has imported anything at all (tells "nothing yet" from "no match"). */
  hasAny: boolean;
};

export type ImportedCsvResult = { status: "OK"; filename: string; csv: string; rows: number; truncated: boolean } | { status: "INVALID" } | { status: "UNAUTHORIZED" };

/** An imported amount on the studio screens: "1,000원" for 원, otherwise the unit's own form. */
export const importedAmountLabel = (value: number, unit: AmountUnit) => (unit === "KRW" ? `${formatNumber(value)}원` : formatUnitAmount(value, unit));
export const importedTotalsLabel = (totals: { unit: AmountUnit; value: number }[]) => (totals.length ? totals.map((t) => importedAmountLabel(t.value, t.unit)).join(" · ") : "0원");

/** Copy shared by the tab and its tests. */
export const IMPORT_PRIVACY_NOTICE = "가져온 내역에는 후원자 닉네임 · 메시지가 들어 있어요. 스튜디오에서 나만 볼 수 있고, 채널 페이지 · 명예의 전당 · 방송 화면에는 보이지 않아요.";
export const IMPORT_SCOPE_NOTICE = "가져온 내역은 FN · 등급 · 칭호 · 후원자 랭킹 · 수익 · 정산에 들어가지 않아요. 수단별 보드에는 이름 없이 출처별 합계(원)만 들어가요.";
export const IMPORT_RETENTION_NOTICE = "되돌리기로 언제든 지울 수 있고, 탈퇴하면 함께 지워져요. 보관 기간은 아직 정하지 않았어요 (TBD).";
