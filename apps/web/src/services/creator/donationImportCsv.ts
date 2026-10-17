import {
  CSV_HEADER_SCAN_ROWS,
  CSV_MAX_COLUMNS,
  EMPTY_MAPPING,
  IMPORT_AMOUNT_MAX,
  IMPORT_FIELDS,
  IMPORT_MESSAGE_MAX,
  IMPORT_NICKNAME_MAX,
  IMPORT_TYPE_MAX,
  type ColumnMapping,
  type CsvEncoding,
  type ImportField,
  type RowErrorCode
} from "./donationImportTypes";

/**
 * 투네이션 CSV reader for 내역 이관 — pure functions (no Node built-ins, no store), used by the server only
 * (./donationImportCore.ts) and the tests. The file content is data: it is never evaluated, and screens show it as text.
 *
 * Assumed format (no real 투네이션 export sample exists — TBD, docs/domains/donation-import.md): one header row (title
 * lines above it are skipped), one donation per row, columns found by header name (aliases below) or picked by hand.
 * Times without a zone are Korea time; amounts are whole 원 ("1,000" · "1000원" · "₩1,000").
 */

// ── Encoding ────────────────────────────────────────────────────────────────────────────────────────────────

/** xlsx (zip) and xls (OLE) files start with these bytes — a spreadsheet saved under a .csv name. */
export function looksLikeSpreadsheet(bytes: Uint8Array) {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  return starts(0x50, 0x4b, 0x03, 0x04) || starts(0xd0, 0xcf, 0x11, 0xe0);
}

type Cp949Tables = { ks: Uint16Array; ext: Uint16Array };
let cp949: Cp949Tables | null | undefined;

/** Index of a CP949 (UHC) extension code among the 8,822 Hangul syllables KS X 1001 lacks, or -1. */
function uhcIndex(lead: number, trail: number) {
  if (lead < 0x81 || lead > 0xc6) return -1;
  let t: number;
  if (trail >= 0x41 && trail <= 0x5a) t = trail - 0x41;
  else if (trail >= 0x61 && trail <= 0x7a) t = 26 + trail - 0x61;
  else if (trail >= 0x81 && trail <= (lead <= 0xa0 ? 0xfe : 0xa0)) t = 52 + trail - 0x81;
  else return -1;
  const i = lead <= 0xa0 ? (lead - 0x81) * 178 + t : 32 * 178 + (lead - 0xa1) * 84 + t;
  return i < 8_822 ? i : -1;
}

/**
 * CP949 (엑셀 "CSV (쉼표로 분리)" on Korean Windows). Node's `euc-kr` decoder covers KS X 1001 only and reads the UHC
 * extension (e.g. 똠 = 8C 63) as two wrong characters without an error. The extension is the 8,822 Hangul syllables KS X
 * 1001 lacks, in Unicode order, so its table is derived from the KS X 1001 one (checked against Windows' CP949 for all
 * 11,172 syllables). null when the runtime has no `euc-kr` decoder (small-icu builds).
 */
function cp949Tables(): Cp949Tables | null {
  if (cp949 !== undefined) return cp949;
  try {
    const dec = new TextDecoder("euc-kr");
    const ks = new Uint16Array(94 * 94);
    const inKs = new Set<number>();
    for (let lead = 0xa1; lead <= 0xfe; lead++) {
      for (let trail = 0xa1; trail <= 0xfe; trail++) {
        const s = dec.decode(Uint8Array.of(lead, trail));
        if (s.length !== 1 || s === "�") continue;
        const c = s.charCodeAt(0);
        ks[(lead - 0xa1) * 94 + (trail - 0xa1)] = c;
        if (c >= 0xac00 && c <= 0xd7a3) inKs.add(c);
      }
    }
    const ext = new Uint16Array(8_822);
    let n = 0;
    for (let c = 0xac00; c <= 0xd7a3 && n < ext.length; c++) if (!inKs.has(c)) ext[n++] = c;
    cp949 = inKs.size === 2_350 && n === 8_822 ? { ks, ext } : null;
  } catch {
    cp949 = null;
  }
  return cp949;
}

function decodeCp949(bytes: Uint8Array): string | null {
  const t = cp949Tables();
  if (!t) return null;
  const codes = new Uint16Array(bytes.length);
  let n = 0;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b < 0x80) {
      codes[n++] = b;
      continue;
    }
    if (i + 1 >= bytes.length) return null;
    const b2 = bytes[++i];
    const e = uhcIndex(b, b2);
    const c = e >= 0 ? t.ext[e] : b >= 0xa1 && b <= 0xfe && b2 >= 0xa1 && b2 <= 0xfe ? t.ks[(b - 0xa1) * 94 + (b2 - 0xa1)] : 0;
    if (!c) return null;
    codes[n++] = c;
  }
  let out = "";
  for (let i = 0; i < n; i += 8_192) out += String.fromCharCode(...codes.subarray(i, Math.min(n, i + 8_192)));
  return out;
}

const strict = (label: string, bytes: Uint8Array) => {
  try {
    return new TextDecoder(label, { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
};

/**
 * The file's text: UTF-8 (with or without BOM), UTF-16 with a BOM (엑셀 "유니코드 텍스트"), otherwise CP949. Text that
 * fits none of them is refused rather than shown garbled.
 */
export function decodeCsvBytes(bytes: Uint8Array): { ok: true; text: string; encoding: CsvEncoding } | { ok: false } {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    const text = strict("utf-16le", bytes);
    return text === null ? { ok: false } : { ok: true, text, encoding: "UTF-16" };
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    const text = strict("utf-16be", bytes);
    return text === null ? { ok: false } : { ok: true, text, encoding: "UTF-16" };
  }
  // The UTF-8 decoder drops a leading BOM (ignoreBOM defaults to false).
  const utf8 = strict("utf-8", bytes);
  if (utf8 !== null) return { ok: true, text: utf8, encoding: "UTF-8" };
  const korean = decodeCp949(bytes);
  return korean === null ? { ok: false } : { ok: true, text: korean, encoding: "CP949" };
}

// ── CSV records ─────────────────────────────────────────────────────────────────────────────────────────────

/** `row`: the record's row number as a spreadsheet shows it (a quoted line break stays in one row). */
export type CsvRecord = { row: number; cells: string[] };

export type ParseOutcome =
  | { ok: true; records: CsvRecord[] }
  | { ok: false; code: "MALFORMED"; row: number }
  | { ok: false; code: "TOO_MANY_COLUMNS" }
  | { ok: false; code: "TOO_MANY_ROWS" };

/** The delimiter of the first line (outside quotes): comma unless tabs or semicolons are clearly what separates it. */
function detectDelimiter(text: string, from: number) {
  const counts: Record<string, number> = { ",": 0, "\t": 0, ";": 0 };
  let quoted = false;
  for (let i = from; i < text.length && i < from + 4_000; i++) {
    const ch = text[i];
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === "\n" || ch === "\r")) break;
    else if (!quoted && Object.hasOwn(counts, ch)) counts[ch]++;
  }
  const best = (["\t", ";"] as const).find((d) => counts[d] > counts[","]);
  return best ?? ",";
}

/**
 * RFC 4180 records with the leniency spreadsheets need: quoted fields with "" escapes and line breaks inside, CRLF ·
 * LF · CR line ends, an Excel `sep=;` first line, comma / tab / semicolon delimiters. Blank lines are skipped (but
 * counted, so row numbers match the spreadsheet). An unclosed quote is MALFORMED with the row it opened in.
 * `maxRecords` stops early on a file that is far too long.
 */
export function parseCsvText(text: string, maxRecords = Number.POSITIVE_INFINITY): ParseOutcome {
  let i = 0;
  let row = 1;
  const sep = /^sep=([,;\t|])\r?\n/i.exec(text.slice(0, 8));
  if (sep) {
    i = sep[0].length;
    row = 2;
  }
  const delimiter = sep ? sep[1] : detectDelimiter(text, i);
  const records: CsvRecord[] = [];
  let cells: string[] = [];
  let field = "";
  let quoted = false;
  let quoteRow = 0;

  const endRecord = () => {
    cells.push(field);
    field = "";
    if (cells.some((c) => c.trim() !== "")) records.push({ row, cells });
    cells = [];
    row++;
  };

  const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"' && field.trim() === "") {
      field = "";
      quoted = true;
      quoteRow = row;
      i++;
      continue;
    }
    if (ch === delimiter) {
      cells.push(field);
      field = "";
      // A row past the column limit stops the read at that delimiter: a long line of separators (a 5 MB file can
      // hold millions) is never split into cells first.
      if (cells.length >= CSV_MAX_COLUMNS) return { ok: false, code: "TOO_MANY_COLUMNS" };
      i++;
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      endRecord();
      if (records.length > maxRecords) return { ok: false, code: "TOO_MANY_ROWS" };
      i += ch === "\r" && text[i + 1] === "\n" ? 2 : 1;
      continue;
    }
    field += ch;
    i++;
  }
  if (quoted) return { ok: false, code: "MALFORMED", row: quoteRow };
  if (field !== "" || cells.length > 0) endRecord();
  if (records.length > maxRecords) return { ok: false, code: "TOO_MANY_ROWS" };
  return { ok: true, records };
}

// ── Columns ─────────────────────────────────────────────────────────────────────────────────────────────────

/** "후원 일시" → "후원일시", "금액(원)" → "금액", "Created_At" → "createdat". */
export function normalizeHeader(h: string) {
  return h
    .normalize("NFC")
    .replace(/﻿/g, "")
    .toLowerCase()
    .replace(/[([（【［][^)\]）】］]*[)\]）】］]/g, "")
    .replace(/[\s_\-.:·/]/g, "");
}

/** Header names per field, normalized. Assumed 투네이션 names first, then common Korean and English ones. */
const ALIASES: Record<ImportField, readonly string[]> = {
  at: ["후원일시", "일시", "날짜", "후원날짜", "후원일", "일자", "시간", "후원시간", "결제일시", "결제일", "date", "time", "datetime", "timestamp", "createdat", "donatedat", "donationdate", "donationtime"],
  nickname: ["닉네임", "후원자", "후원자닉네임", "후원자명", "후원닉네임", "후원자이름", "보낸사람", "보낸이", "이름", "name", "nickname", "nick", "donor", "donorname", "sender", "username"],
  amount: ["금액", "후원금액", "후원액", "캐시", "후원캐시", "결제금액", "amount", "cash", "price", "donationamount"],
  message: ["메시지", "메세지", "후원메시지", "후원메세지", "내용", "후원내용", "코멘트", "comment", "message", "msg", "text", "content"],
  type: ["유형", "후원유형", "종류", "후원종류", "구분", "type", "kind", "category", "donationtype"]
};

/** Second pass for headers no alias names exactly ("후원 금액(캐시)" …). An id column never becomes the nickname. */
const KEYWORDS: Record<ImportField, readonly string[]> = {
  at: ["일시", "날짜", "date", "time"],
  nickname: ["닉네임", "nickname"],
  amount: ["금액", "amount"],
  message: ["메시지", "메세지", "message"],
  type: ["유형", "type"]
};

/** Column per field by header name: exact aliases first (the earliest alias wins), then keywords. */
export function mapHeaders(headers: string[]): ColumnMapping {
  const names = headers.map(normalizeHeader);
  const mapping: ColumnMapping = { ...EMPTY_MAPPING };
  const used = new Set<number>();
  const claim = (field: ImportField, index: number) => {
    mapping[field] = index;
    used.add(index);
  };
  for (const { key } of IMPORT_FIELDS) {
    for (const alias of ALIASES[key]) {
      const i = names.findIndex((n, j) => n === alias && !used.has(j));
      if (i >= 0) {
        claim(key, i);
        break;
      }
    }
  }
  for (const { key } of IMPORT_FIELDS) {
    if (mapping[key] !== null) continue;
    const i = names.findIndex((n, j) => !used.has(j) && n !== "" && !/아이디|^id$|userid/.test(n) && KEYWORDS[key].some((k) => n.includes(k)));
    if (i >= 0) claim(key, i);
  }
  return mapping;
}

export const missingFields = (m: ColumnMapping): ImportField[] => IMPORT_FIELDS.filter((f) => f.required && m[f.key] === null).map((f) => f.key);

/**
 * The header row: the first of the first rows whose names cover every required field; otherwise the one that names the
 * most fields (row 1 when none does — the creator then picks the columns).
 */
export function locateHeader(records: CsvRecord[]): { headerIndex: number; mapping: ColumnMapping; missing: ImportField[] } {
  let best = { headerIndex: 0, mapping: mapHeaders(records[0]?.cells ?? []), score: -1 };
  for (let i = 0; i < Math.min(CSV_HEADER_SCAN_ROWS, records.length); i++) {
    const mapping = mapHeaders(records[i].cells);
    const missing = missingFields(mapping);
    if (missing.length === 0) return { headerIndex: i, mapping, missing };
    const score = IMPORT_FIELDS.filter((f) => mapping[f.key] !== null).length;
    if (score > best.score) best = { headerIndex: i, mapping, score };
  }
  return { headerIndex: best.headerIndex, mapping: best.mapping, missing: missingFields(best.mapping) };
}

/**
 * A column choice sent by the browser: every field null or a column index of this file, no column used twice (fields
 * come from the allow-list, so nothing else of the object is read). Required fields may still be null — the preview
 * then lists them as missing.
 */
export function parseMapping(v: unknown, columns: number): ColumnMapping | null {
  if (typeof v !== "object" || v === null) return null;
  const input = v as Record<string, unknown>;
  const out: ColumnMapping = { ...EMPTY_MAPPING };
  const used = new Set<number>();
  for (const { key } of IMPORT_FIELDS) {
    const x = Object.hasOwn(input, key) ? input[key] : null;
    if (x === null || x === undefined) continue;
    if (typeof x !== "number" || !Number.isInteger(x) || x < 0 || x >= columns || used.has(x)) return null;
    used.add(x);
    out[key] = x;
  }
  return out;
}

// ── Values ──────────────────────────────────────────────────────────────────────────────────────────────────

const KST_OFFSET_MS = 9 * 3_600_000;
/** Clock skew allowed before a time counts as in the future. */
const FUTURE_SLACK_MS = 10 * 60_000;
const ZONED = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})$/i;

/**
 * A donation time as an ISO instant. With a zone (`…Z`, `…+09:00`) it is that instant; otherwise Korea time:
 * "2026-10-16 15:04:05" · "2026-10-16T15:04" · "2026.10.16 15:04" · "2026/10/16 3:04 PM" · "2026. 10. 16. 오후 3:04:05" ·
 * "2026년 10월 16일 15:04" · "2026-10-16" (00:00). Spreadsheet serial numbers and other forms are BAD_DATE.
 */
export function parseKstDateTime(raw: string, now = Date.now()): { iso: string } | { error: "BAD_DATE" | "FUTURE_DATE" } {
  const s = raw.trim().normalize("NFC");
  if (!s) return { error: "BAD_DATE" };
  let instant: number;
  const zoned = ZONED.exec(s);
  if (zoned) {
    const [y, mo, d, h, mi, sec] = zoned.slice(1, 7).map((v) => Number(v ?? 0));
    if (!validParts(y, mo, d, h, mi, sec)) return { error: "BAD_DATE" };
    const zone = /^([+-])(\d{2}):?(\d{2})$/.exec(zoned[7]);
    const offsetMin = zone ? (zone[1] === "-" ? -1 : 1) * (Number(zone[2]) * 60 + Number(zone[3])) : 0;
    if (zone && (Number(zone[2]) > 14 || Number(zone[3]) > 59)) return { error: "BAD_DATE" };
    instant = Date.UTC(y, mo - 1, d, h, mi, sec) - offsetMin * 60_000;
  } else {
    const meridiem = /(오전|오후|am|pm)/i.exec(s)?.[1]?.toLowerCase() ?? null;
    const t = s
      .replace(/(오전|오후|am|pm)/gi, " ")
      .replace(/[년월]/g, "-")
      .replace(/일/g, " ")
      .replace(/(\d)T(\d)/, "$1 $2");
    const m = /^(\d{4})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{1,2})\s*[-.]?\s*(?:(\d{1,2})\s*:\s*(\d{1,2})(?:\s*:\s*(\d{1,2})(?:\.\d+)?)?)?\s*$/.exec(t);
    if (!m) return { error: "BAD_DATE" };
    const [y, mo, d] = [+m[1], +m[2], +m[3]];
    let h = m[4] === undefined ? 0 : +m[4];
    const mi = m[5] === undefined ? 0 : +m[5];
    const sec = m[6] === undefined ? 0 : +m[6];
    if (meridiem) {
      if (m[4] === undefined || h < 1 || h > 12) return { error: "BAD_DATE" };
      const pm = meridiem === "오후" || meridiem === "pm";
      h = (h % 12) + (pm ? 12 : 0);
    }
    if (!validParts(y, mo, d, h, mi, sec)) return { error: "BAD_DATE" };
    instant = Date.UTC(y, mo - 1, d, h, mi, sec) - KST_OFFSET_MS;
  }
  if (!Number.isFinite(instant)) return { error: "BAD_DATE" };
  if (instant > now + FUTURE_SLACK_MS) return { error: "FUTURE_DATE" };
  return { iso: new Date(instant).toISOString() };
}

function validParts(y: number, mo: number, d: number, h: number, mi: number, s: number) {
  if (y < 2000 || y > 2100 || mo < 1 || mo > 12 || h > 23 || mi > 59 || s > 59) return false;
  return d >= 1 && d <= new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

/**
 * Whole 원: "1000" · "1,000" · "1,000원" · "₩1,000" · "1000.00". A minus sign is NON_POSITIVE; any other fraction
 * ("1.5", and "1.000", which could be a European thousands mark) is NON_INTEGER rather than a guess.
 */
export function parseWon(raw: string): { value: number } | { error: Exclude<RowErrorCode, "BAD_DATE" | "FUTURE_DATE" | "EMPTY_NICKNAME"> } {
  const s = raw
    .trim()
    .replace(/\s+/g, "")
    .replace(/^[₩￦]/, "")
    .replace(/(원|캐시|krw)$/i, "");
  const m = /^([+-]?)(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?$/.exec(s);
  if (!m) return { error: "BAD_AMOUNT" };
  const whole = Number(m[2].replace(/,/g, ""));
  if (m[3] !== undefined && !/^0{1,2}$/.test(m[3])) return { error: "NON_INTEGER_AMOUNT" };
  if (m[1] === "-" || whole <= 0) return { error: "NON_POSITIVE_AMOUNT" };
  if (whole > IMPORT_AMOUNT_MAX) return { error: "AMOUNT_TOO_LARGE" };
  return { value: whole };
}

/** C0 / C1 controls and bidi overrides (which could reorder what a screen shows) are removed. */
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F‎‏‪-‮⁦-⁩]/g;

/** One line: controls removed, white space collapsed, cut to `max`. */
export const cleanLine = (v: string, max: number) => v.normalize("NFC").replace(CONTROL, "").replace(/\s+/g, " ").trim().slice(0, max);

/** A message keeps its line breaks (as \n); other controls are removed, cut to IMPORT_MESSAGE_MAX. */
export const cleanMessage = (v: string) =>
  v
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ")
    .replace(CONTROL, "")
    .trim()
    .slice(0, IMPORT_MESSAGE_MAX);

export type ReadRow = { at: string | null; nickname: string; amount: number | null; message: string; type: string | null; errors: RowErrorCode[] };

/** One data row under a complete mapping (cells the row does not have read as empty). */
export function readRow(cells: string[], mapping: ColumnMapping, now = Date.now()): ReadRow {
  const cell = (f: ImportField) => {
    const i = mapping[f];
    return i === null ? "" : (cells[i] ?? "");
  };
  const errors: RowErrorCode[] = [];
  const time = parseKstDateTime(cell("at"), now);
  if ("error" in time) errors.push(time.error);
  const nickname = cleanLine(cell("nickname"), IMPORT_NICKNAME_MAX);
  if (!nickname) errors.push("EMPTY_NICKNAME");
  const won = parseWon(cell("amount"));
  if ("error" in won) errors.push(won.error);
  const type = cleanLine(cell("type"), IMPORT_TYPE_MAX);
  return {
    at: "iso" in time ? time.iso : null,
    nickname,
    amount: "value" in won ? won.value : null,
    message: cleanMessage(cell("message")),
    type: type || null,
    errors
  };
}
