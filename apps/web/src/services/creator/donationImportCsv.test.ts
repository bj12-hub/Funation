import { describe, expect, it } from "vitest";
import {
  cleanLine,
  cleanMessage,
  decodeCsvBytes,
  locateHeader,
  looksLikeSpreadsheet,
  mapHeaders,
  normalizeHeader,
  parseCsvText,
  parseKstDateTime,
  parseMapping,
  parseWon,
  readRow
} from "./donationImportCsv";
import { CSV_MAX_COLUMNS, EMPTY_MAPPING, IMPORT_AMOUNT_MAX, IMPORT_MESSAGE_MAX, IMPORT_NICKNAME_MAX } from "./donationImportTypes";

/** 투네이션 CSV reader (내역 이관): encodings, CSV records, header aliases, values. No real export sample exists (TBD). */

const utf8 = (s: string) => new TextEncoder().encode(s);
const hex = (h: string) => Uint8Array.from(Buffer.from(h, "hex"));
const NOW = Date.parse("2026-10-16T18:00:00+09:00");

describe("decoding", () => {
  it("reads UTF-8 with or without a BOM, and drops the BOM", () => {
    const plain = decodeCsvBytes(utf8("날짜,닉네임\r\n"));
    expect(plain).toEqual({ ok: true, text: "날짜,닉네임\r\n", encoding: "UTF-8" });
    const bom = decodeCsvBytes(Uint8Array.from([0xef, 0xbb, 0xbf, ...utf8("후원일시,금액")]));
    expect(bom).toEqual({ ok: true, text: "후원일시,금액", encoding: "UTF-8" });
  });

  it("reads 엑셀 CSV (CP949), including the UHC syllables Node's euc-kr decoder gets wrong (뷁 · 햏 · 똠)", () => {
    // Windows' CP949 bytes of: 날짜,닉네임,금액,메시지 ⏎ 2026-10-01 12:00:00,뷁햏,"1,000",안녕 똠방각하 ⏎
    const bytes = hex(
      "b3afc2a52cb4d0b3d7c0d32cb1ddbed72cb8debdc3c1f60d0a323032362d31302d30312031323a30303a30302c94eec1642c22312c303030222cbec8b3e7208c63b9e6b0a2c7cf0d0a"
    );
    const r = decodeCsvBytes(bytes);
    expect(r).toEqual({ ok: true, encoding: "CP949", text: '날짜,닉네임,금액,메시지\r\n2026-10-01 12:00:00,뷁햏,"1,000",안녕 똠방각하\r\n' });
    expect(decodeCsvBytes(hex("beb1"))).toEqual({ ok: true, text: "쓩", encoding: "CP949" });
  });

  it("reads UTF-16 with a BOM (엑셀 유니코드 텍스트)", () => {
    const le = Uint8Array.from([0xff, 0xfe, ...Buffer.from("일시\t닉네임\t금액", "utf16le")]);
    expect(decodeCsvBytes(le)).toEqual({ ok: true, text: "일시\t닉네임\t금액", encoding: "UTF-16" });
  });

  it("refuses bytes that are no supported encoding instead of showing them garbled", () => {
    expect(decodeCsvBytes(Uint8Array.from([0x41, 0xff, 0x42]))).toEqual({ ok: false });
    expect(decodeCsvBytes(Uint8Array.from([0x41, 0xb0]))).toEqual({ ok: false }); // a lead byte cut off at the end
  });

  it("spots a spreadsheet saved under a .csv name", () => {
    expect(looksLikeSpreadsheet(Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x14]))).toBe(true);
    expect(looksLikeSpreadsheet(Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1]))).toBe(true);
    expect(looksLikeSpreadsheet(utf8("날짜,닉네임"))).toBe(false);
  });
});

describe("CSV records", () => {
  const cells = (text: string) => {
    const r = parseCsvText(text);
    if (!r.ok) throw new Error(r.code);
    return r.records;
  };

  it("keeps quoted commas, escaped quotes and line breaks inside a message in one row", () => {
    const records = cells('일시,닉네임,금액,메시지\r\n2026-10-01 12:00,"별, 빛",1000,"첫 줄\r\n둘째 줄 ""인용"""\r\n2026-10-01 13:00,달,2000,끝');
    expect(records).toEqual([
      { row: 1, cells: ["일시", "닉네임", "금액", "메시지"] },
      { row: 2, cells: ["2026-10-01 12:00", "별, 빛", "1000", '첫 줄\r\n둘째 줄 "인용"'] },
      { row: 3, cells: ["2026-10-01 13:00", "달", "2000", "끝"] }
    ]);
  });

  it("counts blank lines as rows (spreadsheet numbering) but skips them, and reads LF · CR line ends", () => {
    expect(cells("a,b\n\n1,2\r3,4\n,\n").map((r) => [r.row, ...r.cells])).toEqual([
      [1, "a", "b"],
      [3, "1", "2"],
      [4, "3", "4"]
    ]);
  });

  it("detects tab and semicolon files and honours Excel's sep= line", () => {
    expect(cells("일시\t닉네임\t금액\n1\t2\t3")[1].cells).toEqual(["1", "2", "3"]);
    expect(cells("일시;닉네임;금액\n1;2,5;3")[1].cells).toEqual(["1", "2,5", "3"]);
    const sep = cells("sep=;\n일시;닉네임\n1;2");
    expect(sep).toEqual([
      { row: 2, cells: ["일시", "닉네임"] },
      { row: 3, cells: ["1", "2"] }
    ]);
  });

  it("reports an unclosed quote with the row it opened in", () => {
    expect(parseCsvText('일시,닉네임\n1,2\n3,"열린 채로\n끝')).toEqual({ ok: false, code: "MALFORMED", row: 3 });
  });

  it("stops on too many columns or rows", () => {
    expect(parseCsvText(Array.from({ length: CSV_MAX_COLUMNS + 1 }, (_, i) => `c${i}`).join(","))).toEqual({ ok: false, code: "TOO_MANY_COLUMNS" });
    expect(parseCsvText(Array.from({ length: CSV_MAX_COLUMNS }, (_, i) => `c${i}`).join(",")).ok).toBe(true);
    // The read stops at the delimiter past the limit, not at the end of the row (an unclosed quote after it is never read).
    expect(parseCsvText(`${",".repeat(CSV_MAX_COLUMNS)}"never closed`)).toEqual({ ok: false, code: "TOO_MANY_COLUMNS" });
    expect(parseCsvText("a\n1\n2\n3\n4", 3)).toEqual({ ok: false, code: "TOO_MANY_ROWS" });
    expect(parseCsvText("a\n1\n2", 3).ok).toBe(true);
  });
});

describe("columns", () => {
  it("normalizes header names (spaces, units in brackets, case)", () => {
    expect(normalizeHeader(" 후원 일시 ")).toBe("후원일시");
    expect(normalizeHeader("금액(원)")).toBe("금액");
    expect(normalizeHeader("﻿Created_At")).toBe("createdat");
  });

  it("finds columns by Korean and English aliases, exact names first", () => {
    expect(mapHeaders(["후원일시", "닉네임", "금액", "메시지", "유형"])).toEqual({ at: 0, nickname: 1, amount: 2, message: 3, type: 4 });
    expect(mapHeaders(["Message", "Amount", "Name", "Date"])).toEqual({ at: 3, nickname: 2, amount: 1, message: 0, type: null });
    expect(mapHeaders(["일시", "후원자 아이디", "후원자", "캐시", "내용"])).toEqual({ at: 0, nickname: 2, amount: 3, message: 4, type: null });
    // Keywords for names no alias covers; an id column never becomes the nickname, an exact 금액 beats 정산금액.
    expect(mapHeaders(["후원 발생 일시", "아이디", "후원자 닉네임(표시)", "정산금액", "금액", "메세지 내용"])).toEqual({ at: 0, nickname: 2, amount: 4, message: 5, type: null });
  });

  it("finds the header under title lines, or reports what is missing", () => {
    const records = [
      { row: 1, cells: ["투네이션 후원 내역"] },
      { row: 2, cells: ["기간: 2026-09-01 ~ 2026-09-30"] },
      { row: 3, cells: ["날짜", "닉네임", "금액"] },
      { row: 4, cells: ["2026-09-01 10:00", "별빛", "1000"] }
    ];
    expect(locateHeader(records)).toEqual({ headerIndex: 2, mapping: { ...EMPTY_MAPPING, at: 0, nickname: 1, amount: 2 }, missing: [] });
    expect(locateHeader([{ row: 1, cells: ["col1", "닉네임", "col3"] }])).toEqual({ headerIndex: 0, mapping: { ...EMPTY_MAPPING, nickname: 1 }, missing: ["at", "amount"] });
  });

  it("accepts a hand-picked mapping only with existing, distinct columns", () => {
    expect(parseMapping({ at: 0, nickname: 2, amount: 1, message: null }, 3)).toEqual({ at: 0, nickname: 2, amount: 1, message: null, type: null });
    expect(parseMapping({ at: 0, nickname: 0, amount: 1 }, 3)).toBeNull();
    expect(parseMapping({ at: 3, nickname: 1, amount: 2 }, 3)).toBeNull();
    expect(parseMapping({ at: "0", nickname: 1, amount: 2 }, 3)).toBeNull();
    expect(parseMapping({ at: 1.5 }, 3)).toBeNull();
    expect(parseMapping(null, 3)).toBeNull();
    // Only the allow-listed fields are read.
    expect(parseMapping(JSON.parse('{"__proto__":{"at":9},"at":0}'), 3)).toEqual({ ...EMPTY_MAPPING, at: 0 });
  });
});

describe("values", () => {
  it("reads Korea time in the common export forms", () => {
    const iso = (s: string) => parseKstDateTime(s, NOW);
    expect(iso("2026-10-16 15:04:05")).toEqual({ iso: "2026-10-16T06:04:05.000Z" });
    expect(iso("2026-10-16T15:04")).toEqual({ iso: "2026-10-16T06:04:00.000Z" });
    expect(iso("2026.10.16 15:04")).toEqual({ iso: "2026-10-16T06:04:00.000Z" });
    expect(iso("2026/10/1 3:04 PM")).toEqual({ iso: "2026-10-01T06:04:00.000Z" });
    expect(iso("2026. 10. 16. 오전 12:30:00")).toEqual({ iso: "2026-10-15T15:30:00.000Z" });
    expect(iso("2026. 10. 16. 오후 12:30:00")).toEqual({ iso: "2026-10-16T03:30:00.000Z" });
    expect(iso("2026년 10월 1일 09:05")).toEqual({ iso: "2026-10-01T00:05:00.000Z" });
    expect(iso("2026-10-01")).toEqual({ iso: "2026-09-30T15:00:00.000Z" });
    expect(iso("2026-10-01T09:00:00Z")).toEqual({ iso: "2026-10-01T09:00:00.000Z" });
    expect(iso("2026-10-01 09:00:00+0900")).toEqual({ iso: "2026-10-01T00:00:00.000Z" });
  });

  it("rejects impossible, ambiguous and future dates", () => {
    for (const bad of ["", "2026-02-30 10:00", "2026-13-01", "2026-10-01 24:00", "1999-12-31", "16/10/2026", "45566.5", "어제", "2026-10-01 13:00 PM"]) {
      expect(parseKstDateTime(bad, NOW), bad).toEqual({ error: "BAD_DATE" });
    }
    expect(parseKstDateTime("2026-10-17 12:00", NOW)).toEqual({ error: "FUTURE_DATE" });
    expect(parseKstDateTime("2026-10-16 18:05", NOW)).toEqual({ iso: "2026-10-16T09:05:00.000Z" }); // within the clock-skew slack
  });

  it("reads whole 원 and names what is wrong otherwise", () => {
    for (const ok of ["1000", "1,000", " 1,000원 ", "₩1,000", "+1000", "1000.00", "1000 캐시"]) expect(parseWon(ok), ok).toEqual({ value: 1_000 });
    expect(parseWon("-1000")).toEqual({ error: "NON_POSITIVE_AMOUNT" });
    expect(parseWon("0")).toEqual({ error: "NON_POSITIVE_AMOUNT" });
    expect(parseWon("1000.5")).toEqual({ error: "NON_INTEGER_AMOUNT" });
    expect(parseWon("1.000")).toEqual({ error: "NON_INTEGER_AMOUNT" }); // could be a European thousands mark: not guessed
    for (const bad of ["", "abc", "1,00", "1e3", "(1000)", "10 00원원"]) expect(parseWon(bad), bad).toEqual({ error: "BAD_AMOUNT" });
    expect(parseWon(String(IMPORT_AMOUNT_MAX))).toEqual({ value: IMPORT_AMOUNT_MAX });
    expect(parseWon(String(IMPORT_AMOUNT_MAX + 1))).toEqual({ error: "AMOUNT_TOO_LARGE" });
  });

  it("cleans text: controls and bidi overrides out, messages keep their line breaks, long text is cut", () => {
    expect(cleanLine(" 별\u0000빛‮ 팬 \t", 40)).toBe("별빛 팬");
    expect(cleanLine("가".repeat(50), IMPORT_NICKNAME_MAX)).toHaveLength(IMPORT_NICKNAME_MAX);
    expect(cleanMessage("첫 줄\r\n둘째\t줄\u0007")).toBe("첫 줄\n둘째 줄");
    expect(cleanMessage("x".repeat(600))).toHaveLength(IMPORT_MESSAGE_MAX);
  });

  it("validates a row: every problem is listed, formula-looking text is kept as text", () => {
    const mapping = { at: 0, nickname: 1, amount: 2, message: 3, type: 4 };
    expect(readRow(["2026-10-01 12:00", "=HYPERLINK(\"x\")", "1,000", "@SUM(A1)", "후원"], mapping, NOW)).toEqual({
      at: "2026-10-01T03:00:00.000Z",
      nickname: '=HYPERLINK("x")',
      amount: 1_000,
      message: "@SUM(A1)",
      type: "후원",
      errors: []
    });
    expect(readRow(["내일", " ", "-5"], mapping, NOW)).toEqual({ at: null, nickname: "", amount: null, message: "", type: null, errors: ["BAD_DATE", "EMPTY_NICKNAME", "NON_POSITIVE_AMOUNT"] });
  });
});
