import { createHash, randomUUID } from "node:crypto";
import { toCsv } from "@/lib/csv";
import { kstDateString } from "@/lib/period";
import type { ExternalReceivedDonation, PlatformErrorCode } from "@/services/platforms/platformTypes";
import { unitLabel, type AmountUnit } from "@/types/donationUnit";
import { locateHeader, missingFields, readRow, type CsvRecord } from "./donationImportCsv";
import {
  IMPORT_PREVIEW_ROWS,
  IMPORT_PROBLEM_ROWS,
  IMPORT_SOURCE_LABEL,
  IMPORTED_EXPORT_MAX,
  IMPORTED_PAGE_SIZE,
  IMPORTED_QUERY_MAX,
  IMPORT_SOURCES,
  PREVIEW_TTL_MS,
  sourceOfFilter,
  type ColumnMapping,
  type CsvEncoding,
  type CsvImportResult,
  type CsvPreview,
  type FlexTvSyncCounts,
  type ImportBatchView,
  type ImportSource,
  type ImportedDonationPage,
  type ImportedFilter,
  type PreviewRow,
  type SourceTotal,
  type UndoResult
} from "./donationImportTypes";

/**
 * 내역 이관 store — server-only (node:crypto), not a "use server" module. Imported records live here, apart from every
 * Ssumnation donation, wallet, earnings and settlement record: nothing in those domains reads this store. The only
 * readers are 후원관리+ › 내역 이관 (the creator's own screens) and the 수단별 보드 sums (`importedBoardEntries`, no names).
 * TBD: per-creator storage (the mock has one creator), retention while the account is active, the audit store.
 */

export type ImportRecord = {
  id: string;
  batchId: string;
  source: ImportSource;
  at: string;
  donorName: string;
  message: string;
  kind: string | null;
  amount: number;
  unit: AmountUnit;
  /** 투네이션: a hash of source · time · name · amount · message. FlexTV: `FLEXTV:<External Transaction ID>`. */
  fingerprint: string;
  externalTransactionId: string | null;
  importedAt: string;
};

type StoredBatch = ImportBatchView & { actorId: string; undoneBy: string | null };

/** A parsed file waiting to be imported: its rows stay on the server, the browser only gets the preview. */
export type StoredPreview = {
  id: string;
  owner: string;
  /** The account (재가입 start marker) that read it. */
  account: string | null;
  createdAt: number;
  expiresAt: number;
  fileName: string;
  encoding: CsvEncoding;
  headers: string[];
  data: CsvRecord[];
  mapping: ColumnMapping;
  detected: boolean;
};

type RequestEntry = { state: "PENDING"; previewId: string; mappingKey: string } | { state: "DONE"; previewId: string; mappingKey: string; result: CsvImportResult };

/** Append-only trail of what the creator did (counts only — no donor data). The backend's audit store is TBD. */
export type TrailEntry = { at: string; actorId: string; action: "CSV_IMPORT" | "FLEXTV_SYNC" | "UNDO"; source: ImportSource; batchId: string | null; count: number };

type FlexState = {
  /** The channel the cursor belongs to: another channel starts from the beginning of its history. */
  channelId: string | null;
  cursor: string | null;
  lastSyncAt: string | null;
  lastResult: (FlexTvSyncCounts & { hasMore: boolean }) | null;
  lastError: PlatformErrorCode | null;
  running: boolean;
};

type Store = { records: ImportRecord[]; batches: StoredBatch[]; previews: Record<string, StoredPreview>; requests: Record<string, RequestEntry>; flextv: FlexState; trail: TrailEntry[] };

const fresh = (trail: TrailEntry[] = []): Store => ({
  records: [],
  batches: [],
  previews: {},
  requests: {},
  flextv: { channelId: null, cursor: null, lastSyncAt: null, lastResult: null, lastError: null, running: false },
  trail
});

const g = globalThis as typeof globalThis & { __ssumnationMockDonationImportV1?: Store };
export const importStore = (): Store => (g.__ssumnationMockDonationImportV1 ??= fresh());

/**
 * 회원 탈퇴: the imported records (third-party nicknames and messages), the batches, files waiting in a preview and the
 * FlexTV read position go with the account, like the rest of the creator's data. The trail (counts only) stays.
 */
export function clearDonationImports() {
  g.__ssumnationMockDonationImportV1 = fresh(importStore().trail);
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** The same donation gives the same fingerprint (dedupe within a file and against earlier imports). */
export const fingerprintOf = (source: ImportSource, at: string, nickname: string, amount: number, message: string) =>
  sha256([source, at, nickname, String(amount), sha256(message)].join("\u001F")).slice(0, 40);

const activeFingerprints = (source: ImportSource) => new Set(importStore().records.filter((r) => r.source === source).map((r) => r.fingerprint));

// ── Previews ────────────────────────────────────────────────────────────────────────────────────────────────

/** Previews kept per creator: older ones go (with their rows) when a new file is read. */
const PREVIEWS_PER_OWNER = 3;

export function prunePreviews(now = Date.now()) {
  const previews = importStore().previews;
  for (const [id, p] of Object.entries(previews)) if (p.expiresAt <= now) delete previews[id];
}

export function storePreview(p: Omit<StoredPreview, "id" | "createdAt" | "expiresAt">, now = Date.now()): StoredPreview {
  prunePreviews(now);
  const previews = importStore().previews;
  const own = Object.values(previews)
    .filter((x) => x.owner === p.owner)
    .sort((a, b) => b.createdAt - a.createdAt);
  for (const old of own.slice(PREVIEWS_PER_OWNER - 1)) delete previews[old.id];
  const stored: StoredPreview = { ...p, id: randomUUID(), createdAt: now, expiresAt: now + PREVIEW_TTL_MS };
  previews[stored.id] = stored;
  return stored;
}

/** The creator's own preview of this account, still in time — or null. */
export function findPreview(id: unknown, owner: string, account: string | null, now = Date.now()): StoredPreview | null {
  if (typeof id !== "string") return null;
  const previews = importStore().previews;
  const p = Object.hasOwn(previews, id) ? previews[id] : null;
  return p && p.owner === owner && p.account === account && p.expiresAt > now ? p : null;
}

/** Splits the file into header and data rows (see donationImportCsv `locateHeader`). */
export function splitRecords(records: CsvRecord[]) {
  const { headerIndex, mapping, missing } = locateHeader(records);
  return { headers: records[headerIndex]?.cells ?? [], data: records.slice(headerIndex + 1), mapping, detected: missing.length === 0 };
}

type Evaluated = PreviewRow & { fingerprint: string | null };

/** Every data row with its status: OK, INVALID, a repeat of a row above (DUPLICATE_IN_FILE) or ALREADY_IMPORTED. */
function evaluate(p: StoredPreview, mapping: ColumnMapping, now: number): Evaluated[] {
  const known = activeFingerprints("TOONATION");
  const seen = new Set<string>();
  return p.data.map<Evaluated>(({ row, cells }) => {
    const r = readRow(cells, mapping, now);
    if (r.errors.length > 0 || r.at === null || r.amount === null) return { row, status: "INVALID", ...r, fingerprint: null };
    const fingerprint = fingerprintOf("TOONATION", r.at, r.nickname, r.amount, r.message);
    const status = seen.has(fingerprint) ? "DUPLICATE_IN_FILE" : known.has(fingerprint) ? "ALREADY_IMPORTED" : "OK";
    seen.add(fingerprint);
    return { row, status, ...r, fingerprint };
  });
}

const shown = ({ fingerprint: _f, ...row }: Evaluated): PreviewRow => {
  void _f;
  return row;
};

export function buildPreview(p: StoredPreview, now = Date.now()): CsvPreview {
  const missing = missingFields(p.mapping);
  const base = {
    previewId: p.id,
    fileName: p.fileName,
    encoding: p.encoding,
    headers: [...p.headers],
    mapping: { ...p.mapping },
    missing,
    detected: p.detected,
    sample: p.data.slice(0, 5).map((r) => p.headers.map((_, i) => r.cells[i] ?? "")),
    expiresAt: new Date(p.expiresAt).toISOString()
  };
  if (missing.length > 0) {
    return { ...base, totals: { rows: p.data.length, valid: 0, invalid: 0, duplicateInFile: 0, alreadyImported: 0, amount: 0 }, rows: [], problems: [] };
  }
  const rows = evaluate(p, p.mapping, now);
  const count = (s: PreviewRow["status"]) => rows.filter((r) => r.status === s).length;
  return {
    ...base,
    totals: {
      rows: rows.length,
      valid: count("OK"),
      invalid: count("INVALID"),
      duplicateInFile: count("DUPLICATE_IN_FILE"),
      alreadyImported: count("ALREADY_IMPORTED"),
      amount: rows.reduce((s, r) => s + (r.status === "OK" ? (r.amount ?? 0) : 0), 0)
    },
    rows: rows.slice(0, IMPORT_PREVIEW_ROWS).map(shown),
    problems: rows
      .filter((r) => r.status !== "OK")
      .slice(0, IMPORT_PROBLEM_ROWS)
      .map(shown)
  };
}

// ── Import · undo ───────────────────────────────────────────────────────────────────────────────────────────

export const mappingKeyOf = (m: ColumnMapping) => JSON.stringify([m.at, m.nickname, m.amount, m.message, m.type]);

export const requestEntry = (key: string): RequestEntry | undefined => {
  const requests = importStore().requests;
  return Object.hasOwn(requests, key) ? requests[key] : undefined;
};

const sumByUnit = (rows: { unit: AmountUnit; amount: number }[]) => {
  const totals = new Map<string, { unit: AmountUnit; value: number }>();
  for (const r of rows) {
    const cur = totals.get(r.unit) ?? { unit: r.unit, value: 0 };
    cur.value += r.amount;
    totals.set(r.unit, cur);
  }
  return [...totals.values()];
};

/** A batch as the screen shows it (explicit fields: who did it stays on the server). */
const batchView = (b: StoredBatch): ImportBatchView => ({
  id: b.id,
  source: b.source,
  createdAt: b.createdAt,
  fileName: b.fileName,
  channelHandle: b.channelHandle,
  rows: b.rows,
  imported: b.imported,
  invalid: b.invalid,
  duplicates: b.duplicates,
  totals: b.totals.map((t) => ({ ...t })),
  status: b.status,
  undoneAt: b.undoneAt
});

/**
 * Writes the file's importable rows as one batch — synchronous, so the duplicate check and the write cannot be split by
 * another import. Rows that turned into duplicates since the preview are skipped, not imported twice.
 */
export function commitCsvImport(p: StoredPreview, actorId: string, now = Date.now()): CsvImportResult {
  const rows = evaluate(p, p.mapping, now);
  const ok = rows.filter((r) => r.status === "OK");
  const invalid = rows.filter((r) => r.status === "INVALID").length;
  const duplicates = rows.length - ok.length - invalid;
  if (ok.length === 0) return { status: "NOTHING_TO_IMPORT", invalid, duplicates };
  const s = importStore();
  const at = new Date(now).toISOString();
  const batchId = `ib-${randomUUID()}`;
  for (const r of ok) {
    s.records.push({
      id: `ir-${randomUUID()}`,
      batchId,
      source: "TOONATION",
      at: r.at!,
      donorName: r.nickname,
      message: r.message,
      kind: r.type,
      amount: r.amount!,
      unit: "KRW",
      fingerprint: r.fingerprint!,
      externalTransactionId: null,
      importedAt: at
    });
  }
  const batch: StoredBatch = {
    id: batchId,
    source: "TOONATION",
    createdAt: at,
    fileName: p.fileName,
    channelHandle: null,
    rows: rows.length,
    imported: ok.length,
    invalid,
    duplicates,
    totals: sumByUnit(ok.map((r) => ({ unit: "KRW", amount: r.amount! }))),
    status: "ACTIVE",
    undoneAt: null,
    actorId,
    undoneBy: null
  };
  s.batches.push(batch);
  s.trail.push({ at, actorId, action: "CSV_IMPORT", source: "TOONATION", batchId, count: ok.length });
  return { status: "IMPORTED", batch: batchView(batch) };
}

/** 되돌리기: the batch's records are removed for good; the batch stays (counts only) as 되돌림. Idempotent. */
export function undoBatch(batchId: unknown, actorId: string, now = Date.now()): UndoResult {
  const s = importStore();
  const batch = typeof batchId === "string" ? s.batches.find((b) => b.id === batchId) : undefined;
  if (!batch) return { status: "NOT_FOUND" };
  if (batch.status === "UNDONE") return { status: "UNDONE", removed: 0 };
  const before = s.records.length;
  s.records = s.records.filter((r) => r.batchId !== batch.id);
  const removed = before - s.records.length;
  const at = new Date(now).toISOString();
  Object.assign(batch, { status: "UNDONE", undoneAt: at, undoneBy: actorId });
  s.trail.push({ at, actorId, action: "UNDO", source: batch.source, batchId: batch.id, count: removed });
  return { status: "UNDONE", removed };
}

// ── FlexTV ──────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Writes what a sync read — synchronous (dedupe and write in one step). Each donation is new or already here by its
 * External Transaction ID; a batch is made only when something is new. The read position moves to `cursor`.
 */
export function commitFlexTvSync(
  input: { donations: ExternalReceivedDonation[]; skipped: number; cursor: string | null; hasMore: boolean; channel: { externalChannelId: string; handle: string }; error: PlatformErrorCode | null },
  actorId: string,
  now = Date.now()
): FlexTvSyncCounts {
  const s = importStore();
  const at = new Date(now).toISOString();
  const known = activeFingerprints("FLEXTV");
  const added: ImportRecord[] = [];
  let duplicates = 0;
  const batchId = `ib-${randomUUID()}`;
  for (const d of input.donations) {
    const fingerprint = `FLEXTV:${d.externalTransactionId}`;
    if (known.has(fingerprint)) {
      duplicates++;
      continue;
    }
    known.add(fingerprint);
    added.push({
      id: `ir-${randomUUID()}`,
      batchId,
      source: "FLEXTV",
      at: d.occurredAt,
      donorName: d.donorName,
      message: d.message,
      kind: null,
      amount: d.amount.value,
      unit: d.amount.unit,
      fingerprint,
      externalTransactionId: d.externalTransactionId,
      importedAt: at
    });
  }
  if (added.length > 0) {
    for (const r of added) s.records.push(r);
    s.batches.push({
      id: batchId,
      source: "FLEXTV",
      createdAt: at,
      fileName: null,
      channelHandle: input.channel.handle,
      rows: input.donations.length + input.skipped,
      imported: added.length,
      invalid: input.skipped,
      duplicates,
      totals: sumByUnit(added),
      status: "ACTIVE",
      undoneAt: null,
      actorId,
      undoneBy: null
    });
  }
  s.trail.push({ at, actorId, action: "FLEXTV_SYNC", source: "FLEXTV", batchId: added.length > 0 ? batchId : null, count: added.length });
  const counts = { imported: added.length, duplicates, skipped: input.skipped };
  Object.assign(s.flextv, {
    channelId: input.channel.externalChannelId,
    cursor: input.cursor,
    lastSyncAt: at,
    lastResult: { ...counts, hasMore: input.hasMore },
    lastError: input.error
  });
  return counts;
}

// ── Reads ───────────────────────────────────────────────────────────────────────────────────────────────────

export const batchViews = () => [...importStore().batches].reverse().map(batchView);

export function sourceTotals(): SourceTotal[] {
  const records = importStore().records;
  return IMPORT_SOURCES.map((source) => {
    const own = records.filter((r) => r.source === source);
    return { source, count: own.length, totals: sumByUnit(own) };
  });
}

/** What the 수단별 보드 sums: source, unit, amount and time — never a name or message. */
export const importedBoardEntries = () => importStore().records.map((r) => ({ source: r.source, unit: r.unit, value: r.amount, at: r.at }));

function matching(f: ImportedFilter) {
  const source = sourceOfFilter(f.source);
  const q = f.query.trim().slice(0, IMPORTED_QUERY_MAX).toLowerCase();
  return importStore()
    .records.filter((r) => {
      if (source && r.source !== source) return false;
      const day = kstDateString(new Date(r.at));
      if ((f.from && day < f.from) || (f.to && day > f.to)) return false;
      return !q || r.donorName.toLowerCase().includes(q) || r.message.toLowerCase().includes(q);
    })
    .sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
}

export function importedPage(f: ImportedFilter, page: number): ImportedDonationPage {
  const rows = matching(f);
  const totalPages = Math.max(1, Math.ceil(rows.length / IMPORTED_PAGE_SIZE));
  const p = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  return {
    ...f,
    query: f.query.trim().slice(0, IMPORTED_QUERY_MAX),
    page: p,
    totalPages,
    total: rows.length,
    items: rows.slice((p - 1) * IMPORTED_PAGE_SIZE, p * IMPORTED_PAGE_SIZE).map((r) => ({
      id: r.id,
      source: r.source,
      at: r.at,
      donorName: r.donorName,
      message: r.message,
      kind: r.kind,
      amount: r.amount,
      unit: r.unit
    })),
    totals: sumByUnit(rows),
    hasAny: importStore().records.length > 0
  };
}

/**
 * The matching records as a spreadsheet file. Names and messages came from another platform's file: `toCsv` prefixes
 * any cell that a spreadsheet would run as a formula (= + - @ tab CR) with an apostrophe.
 */
export function importedCsv(f: ImportedFilter) {
  const rows = matching(f);
  const kept = rows.slice(0, IMPORTED_EXPORT_MAX);
  const csv = toCsv(
    ["후원 일시 (한국 시간)", "출처", "후원자 닉네임", "금액", "단위", "메시지", "유형"],
    kept.map((r) => [new Date(Date.parse(r.at) + 9 * 3_600_000).toISOString().slice(0, 19).replace("T", " "), IMPORT_SOURCE_LABEL[r.source], r.donorName, r.amount, unitLabel(r.unit), r.message, r.kind ?? ""])
  );
  return { csv, rows: kept.length, truncated: rows.length > kept.length };
}
