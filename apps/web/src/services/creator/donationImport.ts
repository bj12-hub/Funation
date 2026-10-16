"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { isIsoDate, kstDateString } from "@/lib/period";
import { memberKeyOf } from "@/lib/records";
import { getCreatorSession } from "@/lib/session";
import { sessionAccount } from "@/services/account/withdrawalCore";
import { broadcastChannel, broadcastChannelId } from "@/services/broadcast/channelsCore";
import { ADAPTERS, withTimeout } from "@/services/platforms/adapters";
import { PlatformError, type ExternalReceivedDonation, type PlatformErrorCode } from "@/services/platforms/platformTypes";
import {
  batchViews,
  buildPreview,
  commitCsvImport,
  commitFlexTvSync,
  findPreview,
  importStore,
  importedCsv,
  importedPage,
  mappingKeyOf,
  requestEntry,
  sourceTotals,
  splitRecords,
  storePreview,
  undoBatch
} from "./donationImportCore";
import { cleanLine, decodeCsvBytes, looksLikeSpreadsheet, missingFields, parseCsvText, parseMapping } from "./donationImportCsv";
import {
  CSV_FILE_ERROR_MESSAGE,
  CSV_HEADER_SCAN_ROWS,
  CSV_MAX_BYTES,
  CSV_MAX_ROWS,
  FLEXTV_SYNC_ERROR,
  FLEXTV_SYNC_MAX_PAGES,
  IMPORTED_QUERY_MAX,
  IMPORTED_SOURCE_FILTERS,
  IMPORT_FILE_NAME_MAX,
  IMPORT_FIELDS,
  malformedMessage,
  type CsvFileError,
  type CsvImportResult,
  type CsvPreviewResult,
  type FlexTvSyncResult,
  type ImportOverview,
  type ImportedCsvResult,
  type ImportedDonationPage,
  type ImportedFilter,
  type ImportedSourceFilter,
  type UndoResult
} from "./donationImportTypes";

/**
 * 내역 이관 Server Actions — code-first, route `/creator/donations?tab=import` (docs/domains/donation-import.md).
 * Every action needs the Creator role (a supporter, a suspended or withdrawn creator has no creator session) and
 * re-validates its input; the file is parsed here, never in the browser. Writes happen in one synchronous step after the
 * last await, for the account the request started with (`sessionAccount`). Nothing here touches FN, wallets, earnings,
 * settlement, 등급 · 칭호 or the FN rankings.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Donation import API is not connected yet.");
};

const REQUEST_ID = /^[A-Za-z0-9-]{16,64}$/;
const obj = (v: unknown) => (typeof v === "object" && v !== null ? v : {}) as Record<string, unknown>;
const invalid = (code: Exclude<CsvFileError, "MALFORMED">) => ({ status: "INVALID" as const, code, message: CSV_FILE_ERROR_MESSAGE[code] });

/** The file's own name without folders, controls or overlong text (shown in 가져온 기록). */
const cleanFileName = (name: string) => cleanLine(name.split(/[\\/]/).pop() ?? "", IMPORT_FILE_NAME_MAX) || "이름 없는 파일.csv";

// ── Overview ────────────────────────────────────────────────────────────────────────────────────────────────

export async function getDonationImportOverview(): Promise<ImportOverview | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  await mockDelay(200);
  const flex = importStore().flextv;
  const channel = broadcastChannel("FLEXTV");
  const adapter = ADAPTERS.FLEXTV;
  // The last sync shown belongs to the linked channel; another channel starts over.
  const sameChannel = !!channel && flex.channelId === channel.externalChannelId;
  return {
    batches: batchViews(),
    totals: sourceTotals(),
    flextv: {
      supported: adapter.capabilities.includes("DONATION_HISTORY"),
      unverified: adapter.unverified.includes("DONATION_HISTORY"),
      linked: channel ? { handle: channel.handle, title: channel.title } : null,
      lastSyncAt: sameChannel ? flex.lastSyncAt : null,
      lastResult: sameChannel && flex.lastResult ? { ...flex.lastResult } : null,
      lastError: sameChannel ? flex.lastError : null
    }
  };
}

// ── 투네이션 CSV ────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Reads the uploaded file (FormData `file`) on the server and returns its preview. The rows stay on the server under
 * the preview id (30 minutes, sample value); nothing is imported yet.
 */
export async function previewToonationCsv(formData: unknown): Promise<CsvPreviewResult> {
  assertMock();
  const session = await getCreatorSession();
  if (!session) return { status: "UNAUTHORIZED" };
  const { account, stillHere } = sessionAccount();
  const file = formData instanceof FormData ? formData.get("file") : null;
  if (!(file instanceof File)) return invalid("NO_FILE");
  if (file.size > CSV_MAX_BYTES) return invalid("TOO_LARGE");
  if (/\.(xlsx|xlsm|xls)$/i.test(file.name)) return invalid("SPREADSHEET");
  if (!/\.(csv|txt|tsv)$/i.test(file.name)) return invalid("NOT_CSV");
  if (file.size === 0) return invalid("EMPTY");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > CSV_MAX_BYTES) return invalid("TOO_LARGE");
  if (looksLikeSpreadsheet(bytes)) return invalid("SPREADSHEET");
  const decoded = decodeCsvBytes(bytes);
  if (!decoded.ok) return invalid("ENCODING");
  const parsed = parseCsvText(decoded.text, CSV_MAX_ROWS + CSV_HEADER_SCAN_ROWS);
  if (!parsed.ok) return parsed.code === "MALFORMED" ? { status: "INVALID", code: "MALFORMED", message: malformedMessage(parsed.row) } : invalid(parsed.code);
  if (parsed.records.length === 0) return invalid("EMPTY");
  const { headers, data, mapping, detected } = splitRecords(parsed.records);
  if (data.length === 0) return invalid("NO_DATA");
  if (data.length > CSV_MAX_ROWS) return invalid("TOO_MANY_ROWS");
  // The file's rows are personal data of the account that read them: not kept for one that has withdrawn meanwhile.
  if (!stillHere()) return { status: "UNAUTHORIZED" };
  const preview = storePreview({
    owner: session.userId,
    account,
    fileName: cleanFileName(file.name),
    encoding: decoded.encoding,
    headers: headers.map((h) => cleanLine(h, 40)),
    data,
    mapping,
    detected
  });
  return { status: "OK", preview: buildPreview(preview) };
}

/** The creator picks the columns by hand (`mapping`: column index per field, or null). */
export async function remapToonationCsv(input: unknown): Promise<CsvPreviewResult> {
  assertMock();
  const session = await getCreatorSession();
  if (!session) return { status: "UNAUTHORIZED" };
  const { account, stillHere } = sessionAccount();
  const v = obj(input);
  const preview = findPreview(v.previewId, session.userId, account);
  if (!preview) return invalid("EXPIRED");
  const mapping = parseMapping(v.mapping, preview.headers.length);
  if (!mapping) return invalid("BAD_MAPPING");
  await mockDelay(200);
  const current = findPreview(preview.id, session.userId, account);
  if (!stillHere()) return { status: "UNAUTHORIZED" };
  if (!current) return invalid("EXPIRED");
  current.mapping = mapping;
  return { status: "OK", preview: buildPreview(current) };
}

/** The column choice as sent, for comparing a retry with the request it repeats (also once the preview is gone). */
function sentMappingKey(v: unknown) {
  const m = obj(v);
  const value = (k: string) => {
    const x = Object.hasOwn(m, k) ? m[k] : null;
    return x === null || x === undefined ? null : typeof x === "number" && Number.isInteger(x) ? x : NaN;
  };
  const keys = IMPORT_FIELDS.map((f) => value(f.key));
  return keys.some((k) => Number.isNaN(k)) ? null : JSON.stringify(keys);
}

/**
 * Imports the previewed file with the chosen columns. One request id per intended import: a retry (lost response,
 * double click) gets the first result, the same id with another preview or column choice is CONFLICT, and one still
 * running is IN_PROGRESS. Rows already imported (by fingerprint) are skipped, so a file sent again adds nothing.
 */
export async function importToonationCsv(input: unknown): Promise<CsvImportResult> {
  assertMock();
  const v = obj(input);
  if (typeof v.requestId !== "string" || !REQUEST_ID.test(v.requestId) || typeof v.previewId !== "string") return invalid("BAD_REQUEST");
  const session = await getCreatorSession();
  if (!session) return { status: "UNAUTHORIZED" };
  const { account, stillHere } = sessionAccount();
  const key = memberKeyOf(session.userId, v.requestId);
  const sentKey = sentMappingKey(v.mapping);
  const earlier = requestEntry(key);
  if (earlier) {
    if (earlier.previewId !== v.previewId || earlier.mappingKey !== sentKey) return { status: "CONFLICT" };
    return earlier.state === "DONE" ? earlier.result : { status: "IN_PROGRESS" };
  }
  const preview = findPreview(v.previewId, session.userId, account);
  if (!preview) return invalid("EXPIRED");
  const mapping = parseMapping(v.mapping, preview.headers.length);
  if (!mapping || missingFields(mapping).length > 0 || sentKey !== mappingKeyOf(mapping)) return invalid("BAD_MAPPING");
  importStore().requests[key] = { state: "PENDING", previewId: preview.id, mappingKey: sentKey };
  await mockDelay(400);

  // One synchronous step from here: the account check, the duplicate check and the write.
  const requests = importStore().requests;
  if (!stillHere()) {
    delete requests[key];
    return { status: "UNAUTHORIZED" };
  }
  const current = findPreview(preview.id, session.userId, account);
  if (!current) {
    delete requests[key];
    return invalid("EXPIRED");
  }
  current.mapping = mapping;
  const result = commitCsvImport(current, session.userId);
  requests[key] = { state: "DONE", previewId: current.id, mappingKey: sentKey, result };
  return result;
}

/** 되돌리기: removes the batch's records for good (투네이션 file or FlexTV sync). Undoing it again changes nothing. */
export async function undoDonationImport(input: unknown): Promise<UndoResult> {
  assertMock();
  const session = await getCreatorSession();
  if (!session) return { status: "UNAUTHORIZED" };
  const { stillHere } = sessionAccount();
  const { batchId } = obj(input);
  if (typeof batchId !== "string") return { status: "NOT_FOUND" };
  await mockDelay(300);
  if (!stillHere()) return { status: "UNAUTHORIZED" };
  return undoBatch(batchId, session.userId);
}

// ── FlexTV ──────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * "FlexTV 내역 가져오기": reads the linked channel's received-donation history after the last position, up to
 * FLEXTV_SYNC_MAX_PAGES pages, and imports what is new by External Transaction ID. A failure part-way keeps the pages
 * read before it (and their position); a read whose account or FlexTV link changed meanwhile writes nothing. One sync at
 * a time. How far back the first sync goes is what FlexTV returns (TBD).
 */
export async function syncFlexTvDonations(): Promise<FlexTvSyncResult> {
  assertMock();
  const session = await getCreatorSession();
  if (!session) return { status: "UNAUTHORIZED" };
  const { stillHere } = sessionAccount();
  const adapter = ADAPTERS.FLEXTV;
  if (!adapter.capabilities.includes("DONATION_HISTORY")) return { status: "UNSUPPORTED" };
  const channel = broadcastChannel("FLEXTV");
  if (!channel) return { status: "NOT_LINKED" };
  const flex = importStore().flextv;
  if (flex.running) return { status: "IN_PROGRESS" };
  flex.running = true;
  try {
    let cursor = flex.channelId === channel.externalChannelId ? flex.cursor : null;
    const donations: ExternalReceivedDonation[] = [];
    let skipped = 0;
    let hasMore = false;
    let error: PlatformErrorCode | null = null;
    for (let page = 0; page < FLEXTV_SYNC_MAX_PAGES; page++) {
      try {
        const got = await withTimeout(adapter.fetchReceivedDonations(channel.externalChannelId, { cursor, since: null }));
        donations.push(...got.donations);
        skipped += got.skipped;
        cursor = got.cursor;
        hasMore = got.hasMore;
        if (!got.hasMore) break;
      } catch (e) {
        error = e instanceof PlatformError ? e.code : "UNAVAILABLE";
        break;
      }
    }

    // One synchronous step from here: the read is kept only for the account and the FlexTV link it started with.
    if (!stillHere()) return { status: "UNAUTHORIZED" };
    if (broadcastChannelId("FLEXTV") !== channel.externalChannelId) return { status: "FAILED", code: "CHANNEL_CHANGED", message: FLEXTV_SYNC_ERROR.CHANNEL_CHANGED, imported: 0, duplicates: 0, skipped: 0 };
    const current = importStore().flextv;
    if (error && donations.length === 0 && skipped === 0) {
      // Nothing read: the position stays. A first read of another channel already belongs to that channel.
      if (current.channelId !== channel.externalChannelId) Object.assign(current, { channelId: channel.externalChannelId, cursor: null, lastSyncAt: null, lastResult: null });
      current.lastError = error;
      return error === "UNSUPPORTED" ? { status: "UNSUPPORTED" } : { status: "FAILED", code: error, message: FLEXTV_SYNC_ERROR[error], imported: 0, duplicates: 0, skipped: 0 };
    }
    const counts = commitFlexTvSync({ donations, skipped, cursor, hasMore: hasMore || error !== null, channel, error }, session.userId);
    if (error) return { status: "FAILED", code: error, message: FLEXTV_SYNC_ERROR[error], ...counts };
    return { status: "OK", hasMore, syncedAt: current.lastSyncAt ?? new Date().toISOString(), ...counts };
  } finally {
    flex.running = false;
  }
}

// ── 가져온 내역 ─────────────────────────────────────────────────────────────────────────────────────────────

/** URL / request filter: unknown values fall back to 전체 · every date · no search. */
function parseFilter(raw: Record<string, unknown>): ImportedFilter {
  const source = IMPORTED_SOURCE_FILTERS.find((f) => f.key === raw.source)?.key ?? "all";
  let from = isIsoDate(raw.from) ? raw.from : null;
  let to = isIsoDate(raw.to) ? raw.to : null;
  if (from && to && from > to) from = to = null;
  return { source: source as ImportedSourceFilter, from, to, query: typeof raw.q === "string" ? raw.q.trim().slice(0, IMPORTED_QUERY_MAX) : "" };
}

export async function getImportedDonations(input: unknown): Promise<ImportedDonationPage | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  const v = obj(input);
  await mockDelay(250);
  return importedPage(parseFilter(v), typeof v.page === "number" ? v.page : 1);
}

/** 가져온 내역 CSV (same filters, every page, capped — sample value). Formula-looking cells are escaped (lib/csv.ts). */
export async function exportImportedDonationsCsv(input: unknown): Promise<ImportedCsvResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const filter = parseFilter(obj(input));
  await mockDelay(300);
  const { csv, rows, truncated } = importedCsv(filter);
  return { status: "OK", filename: `ssumnation-imported-donations-${kstDateString()}.csv`, csv, rows, truncated };
}
