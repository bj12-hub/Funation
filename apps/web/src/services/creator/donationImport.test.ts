import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn, signInAs } from "@/test/mockEnv";

/** `during` runs inside the next mock delay, i.e. while the server is "busy" between its checks and its write. */
const delay = vi.hoisted(() => ({ during: null as null | (() => unknown) }));
vi.mock("@/lib/mock", () => ({
  USE_MOCK: true,
  mockDelay: async () => {
    const run = delay.during;
    delay.during = null;
    await run?.();
  }
}));
vi.mock("@/lib/session", () => mockSessionModule());

/**
 * 내역 이관 (2026-10-16, 기본값 — TBD): 투네이션 CSV upload with preview, idempotent import and 되돌리기; FlexTV history
 * through the linked account. Imported records stay in their own store: creator-only screens and 수단별 보드 sums.
 */
async function load() {
  const actions = await import("./donationImport");
  const core = await import("./donationImportCore");
  const remote = await import("@/services/platforms/mockHistoryRemote");
  const chat = await import("@/services/broadcast/unifiedChat");
  const { channelsStore } = await import("@/services/broadcast/channelsCore");
  const { ADAPTERS } = await import("@/services/platforms/adapters");
  return { ...actions, core, remote, chat, channelsStore, ADAPTERS };
}
type M = Awaited<ReturnType<typeof load>>;

const form = (content: BlobPart, name = "toonation.csv") => {
  const fd = new FormData();
  fd.append("file", new File([content], name, { type: "text/csv" }));
  return fd;
};

const CSV = [
  "후원일시,닉네임,금액,메시지,유형",
  '2026-09-01 20:15:03,별빛소나기,"1,000",오늘 방송 재밌어요!,후원',
  '2026-09-01 20:40:11,새벽라디오,10000,"두 줄',
  '메시지",후원',
  "2026-09-02 21:05:47,콩떡이,5000,,후원",
  "2026-09-02 21:05:47,콩떡이,5000,,후원",
  "내일,,-5,잘못된 줄,후원"
].join("\r\n");

async function preview(m: M, content: BlobPart = CSV, name?: string) {
  const r = await m.previewToonationCsv(form(content, name));
  if (r.status !== "OK") throw new Error(JSON.stringify(r));
  return r.preview;
}

async function importCsv(m: M, content: BlobPart = CSV, n = 1) {
  const p = await preview(m, content);
  return m.importToonationCsv({ previewId: p.previewId, mapping: p.mapping, requestId: key(n) });
}

const records = async (m: M, filter: Record<string, unknown> = {}) => (await m.getImportedDonations(filter))!;

describe("투네이션 CSV 미리보기", () => {
  beforeEach(() => resetMockStores());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("reads the file on the server: totals, the first rows and every row it will skip, with the reason", async () => {
    const m = await load();
    const p = await preview(m);
    expect(p).toMatchObject({ fileName: "toonation.csv", encoding: "UTF-8", headers: ["후원일시", "닉네임", "금액", "메시지", "유형"], missing: [], detected: true });
    expect(p.mapping).toEqual({ at: 0, nickname: 1, amount: 2, message: 3, type: 4 });
    expect(p.totals).toEqual({ rows: 5, valid: 3, invalid: 1, duplicateInFile: 1, alreadyImported: 0, amount: 16_000 });
    expect(p.rows[1]).toEqual({ row: 3, status: "OK", at: "2026-09-01T11:40:11.000Z", nickname: "새벽라디오", amount: 10_000, message: "두 줄\n메시지", type: "후원", errors: [] });
    expect(p.problems.map((r) => [r.row, r.status, r.errors])).toEqual([
      [5, "DUPLICATE_IN_FILE", []],
      [6, "INVALID", ["BAD_DATE", "EMPTY_NICKNAME", "NON_POSITIVE_AMOUNT"]]
    ]);
    // Nothing is imported by a preview.
    expect((await records(m)).total).toBe(0);
  });

  it("refuses files it cannot read, with what to do", async () => {
    const m = await load();
    const code = async (fd: unknown) => {
      const r = await m.previewToonationCsv(fd);
      return r.status === "INVALID" ? r.code : r.status;
    };
    expect(await code(new FormData())).toBe("NO_FILE");
    expect(await code({ file: "x" })).toBe("NO_FILE");
    expect(await code(form(CSV, "내역.pdf"))).toBe("NOT_CSV");
    expect(await code(form(CSV, "내역.xlsx"))).toBe("SPREADSHEET");
    expect(await code(form(Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0, 0]), "내역.csv"))).toBe("SPREADSHEET");
    expect(await code(form(""))).toBe("EMPTY");
    expect(await code(form("\r\n\r\n"))).toBe("EMPTY");
    expect(await code(form("후원일시,닉네임,금액\r\n"))).toBe("NO_DATA");
    expect(await code(form(Uint8Array.from([0x41, 0xff, 0x42])))).toBe("ENCODING");
    expect(await code(form("x".repeat(5 * 1024 * 1024 + 1)))).toBe("TOO_LARGE");
    const rows = ["일시,닉네임,금액", ...Array.from({ length: 20_001 }, (_, i) => `2026-09-01 10:00:00,팬${i},1000`)].join("\n");
    expect(await code(form(rows))).toBe("TOO_MANY_ROWS");
    expect(await m.previewToonationCsv(form('일시,닉네임,금액\n2026-09-01,a,1\n2026-09-01,"b,1'))).toEqual({
      status: "INVALID",
      code: "MALFORMED",
      message: "3행에서 따옴표가 닫히지 않았어요. 파일을 확인해 주세요."
    });
  });

  it("reads 엑셀 CSV (CP949) files end to end", async () => {
    const m = await load();
    const bytes = Uint8Array.from(
      Buffer.from(
        "b3afc2a52cb4d0b3d7c0d32cb1ddbed72cb8debdc3c1f60d0a323032362d31302d30312031323a30303a30302c94eec1642c22312c303030222cbec8b3e7208c63b9e6b0a2c7cf0d0a",
        "hex"
      )
    );
    const p = await preview(m, bytes);
    expect(p.encoding).toBe("CP949");
    expect(p.rows[0]).toMatchObject({ status: "OK", nickname: "뷁햏", amount: 1_000, message: "안녕 똠방각하" });
  });

  it("lets the creator pick the columns when the header names are unknown", async () => {
    const m = await load();
    const p = await preview(m, "col_a,col_b,col_c,col_d\r\n2026-09-03 10:00,구름빵,3000,안녕\r\n2026-09-03 11:00,달토끼,2000,");
    expect(p).toMatchObject({ missing: ["at", "nickname", "amount"], detected: false, totals: { rows: 2, valid: 0 }, rows: [], problems: [] });
    expect(p.sample).toEqual([
      ["2026-09-03 10:00", "구름빵", "3000", "안녕"],
      ["2026-09-03 11:00", "달토끼", "2000", ""]
    ]);
    // Not importable until the required columns are picked.
    expect(await m.importToonationCsv({ previewId: p.previewId, mapping: p.mapping, requestId: key(1) })).toMatchObject({ status: "INVALID", code: "BAD_MAPPING" });
    expect(await m.remapToonationCsv({ previewId: p.previewId, mapping: { at: 0, nickname: 0, amount: 2 } })).toMatchObject({ status: "INVALID", code: "BAD_MAPPING" });
    expect(await m.remapToonationCsv({ previewId: p.previewId, mapping: { at: 0, nickname: 1, amount: 9 } })).toMatchObject({ status: "INVALID", code: "BAD_MAPPING" });

    const mapping = { at: 0, nickname: 1, amount: 2, message: 3, type: null };
    const r = await m.remapToonationCsv({ previewId: p.previewId, mapping });
    expect(r).toMatchObject({ status: "OK", preview: { missing: [], mapping, totals: { rows: 2, valid: 2, amount: 5_000 } } });
    expect(await m.importToonationCsv({ previewId: p.previewId, mapping, requestId: key(2) })).toMatchObject({ status: "IMPORTED", batch: { imported: 2 } });
  });

  it("keeps a preview for its own creator and account, for 30 minutes (sample value)", async () => {
    const m = await load();
    const p = await preview(m);
    signInAs("u-other");
    expect(await m.remapToonationCsv({ previewId: p.previewId, mapping: p.mapping })).toMatchObject({ status: "INVALID", code: "EXPIRED" });
    expect(await m.importToonationCsv({ previewId: p.previewId, mapping: p.mapping, requestId: key(1) })).toMatchObject({ status: "INVALID", code: "EXPIRED" });
    signInAs("u-test");
    expect(await m.remapToonationCsv({ previewId: "__proto__", mapping: p.mapping })).toMatchObject({ code: "EXPIRED" });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 31 * 60_000);
    expect(await m.importToonationCsv({ previewId: p.previewId, mapping: p.mapping, requestId: key(2) })).toMatchObject({ status: "INVALID", code: "EXPIRED" });
  });
});

describe("투네이션 CSV 가져오기 · 되돌리기", () => {
  beforeEach(() => resetMockStores());
  afterEach(() => vi.restoreAllMocks());

  it("imports once per request id and skips what was imported before", async () => {
    const m = await load();
    const p = await preview(m);
    const input = { previewId: p.previewId, mapping: p.mapping, requestId: key(1) };
    const first = await m.importToonationCsv(input);
    expect(first).toMatchObject({
      status: "IMPORTED",
      batch: { source: "TOONATION", fileName: "toonation.csv", rows: 5, imported: 3, invalid: 1, duplicates: 1, totals: [{ unit: "KRW", value: 16_000 }], status: "ACTIVE" }
    });
    // A retry (lost response, double click) is the same import.
    expect(await m.importToonationCsv(input)).toEqual(first);
    expect((await records(m)).total).toBe(3);
    // The same id for another preview or another column choice is refused.
    const other = await preview(m);
    expect(await m.importToonationCsv({ ...input, previewId: other.previewId })).toEqual({ status: "CONFLICT" });
    expect(await m.importToonationCsv({ ...input, mapping: { ...p.mapping, type: null } })).toEqual({ status: "CONFLICT" });
    expect(await m.importToonationCsv({ ...input, requestId: "short" })).toMatchObject({ status: "INVALID", code: "BAD_REQUEST" });

    // The same file again: every row is already there.
    expect(other.totals).toMatchObject({ valid: 0, alreadyImported: 3, duplicateInFile: 1, invalid: 1 });
    expect(await m.importToonationCsv({ previewId: other.previewId, mapping: other.mapping, requestId: key(2) })).toEqual({ status: "NOTHING_TO_IMPORT", invalid: 1, duplicates: 4 });
    expect(m.core.importStore().batches).toHaveLength(1);
    expect(m.core.importStore().trail).toEqual([expect.objectContaining({ action: "CSV_IMPORT", source: "TOONATION", actorId: "u-test", count: 3 })]);
  });

  it("answers IN_PROGRESS while the same request is still running, and writes once", async () => {
    const m = await load();
    const p = await preview(m);
    const input = { previewId: p.previewId, mapping: p.mapping, requestId: key(3) };
    let during: unknown;
    delay.during = async () => {
      during = await m.importToonationCsv(input);
    };
    expect(await m.importToonationCsv(input)).toMatchObject({ status: "IMPORTED" });
    expect(during).toEqual({ status: "IN_PROGRESS" });
    expect((await records(m)).total).toBe(3);
  });

  it("checks duplicates again when it writes: a row imported meanwhile is not imported twice", async () => {
    const m = await load();
    const a = await preview(m);
    const b = await preview(m);
    delay.during = () => m.importToonationCsv({ previewId: b.previewId, mapping: b.mapping, requestId: key(5) });
    const r = await m.importToonationCsv({ previewId: a.previewId, mapping: a.mapping, requestId: key(4) });
    expect(r).toEqual({ status: "NOTHING_TO_IMPORT", invalid: 1, duplicates: 4 });
    expect((await records(m)).total).toBe(3);
  });

  it("writes nothing for an account that withdrew while the import was running", async () => {
    const m = await load();
    const p = await preview(m);
    const { recordWithdrawal } = await import("@/services/account/withdrawalRecord");
    delay.during = () => recordWithdrawal({ at: new Date().toISOString(), requestId: "w-during", forfeitedFn: 0, forfeitedEarningsFn: 0 });
    expect(await m.importToonationCsv({ previewId: p.previewId, mapping: p.mapping, requestId: key(6) })).toEqual({ status: "UNAUTHORIZED" });
    expect(m.core.importStore().records).toHaveLength(0);
    expect(m.core.importStore().batches).toHaveLength(0);
  });

  it("되돌리기 removes that batch's records for good, once; the batch stays as 되돌림", async () => {
    const m = await load();
    const first = await importCsv(m, CSV, 1);
    const second = await importCsv(m, "후원일시,닉네임,금액\r\n2026-09-05 10:00,노을빛,7000", 2);
    if (first.status !== "IMPORTED" || second.status !== "IMPORTED") throw new Error("import failed");
    expect((await records(m)).total).toBe(4);

    expect(await m.undoDonationImport({ batchId: first.batch.id })).toEqual({ status: "UNDONE", removed: 3 });
    expect(await m.undoDonationImport({ batchId: first.batch.id })).toEqual({ status: "UNDONE", removed: 0 });
    expect(await m.undoDonationImport({ batchId: "ib-unknown" })).toEqual({ status: "NOT_FOUND" });
    expect(await m.undoDonationImport({ batchId: 7 })).toEqual({ status: "NOT_FOUND" });
    const left = await records(m);
    expect(left.items.map((r) => r.donorName)).toEqual(["노을빛"]);
    const overview = (await m.getDonationImportOverview())!;
    expect(overview.batches.map((b) => [b.id, b.status, b.undoneAt !== null])).toEqual([
      [second.batch.id, "ACTIVE", false],
      [first.batch.id, "UNDONE", true]
    ]);
    expect(overview.totals.find((t) => t.source === "TOONATION")).toEqual({ source: "TOONATION", count: 1, totals: [{ unit: "KRW", value: 7_000 }] });
    // Once undone, the same file can be imported again.
    expect(await importCsv(m, CSV, 3)).toMatchObject({ status: "IMPORTED", batch: { imported: 3 } });
    expect(m.core.importStore().trail.map((t) => t.action)).toEqual(["CSV_IMPORT", "CSV_IMPORT", "UNDO", "CSV_IMPORT"]);
  });
});

describe("가져온 내역", () => {
  beforeEach(() => resetMockStores());

  it("lists the records newest first with 출처 · 기간 (Korea days) · 검색 filters and pages", async () => {
    const m = await load();
    const rows = Array.from({ length: 23 }, (_, i) => `2026-09-${String(i + 1).padStart(2, "0")} 12:00,팬${i + 1},${(i + 1) * 1000},${i % 2 ? "생일 축하" : ""}`);
    await importCsv(m, ["일시,닉네임,금액,메시지", "2026-09-30 23:59:59,마지막날,1000,", "2026-10-01 00:00:00,첫날,2000,", ...rows].join("\n"), 1);

    const all = await records(m);
    expect(all).toMatchObject({ source: "all", total: 25, page: 1, totalPages: 2, hasAny: true, totals: [{ unit: "KRW", value: 3_000 + 276_000 }] });
    expect(all.items[0]).toMatchObject({ donorName: "첫날", source: "TOONATION", amount: 2_000, unit: "KRW" });
    expect((await records(m, { page: 2 })).items).toHaveLength(5);
    expect((await records(m, { from: "2026-10-01", to: "2026-10-31" })).items.map((r) => r.donorName)).toEqual(["첫날"]);
    expect((await records(m, { from: "2026-09-30", to: "2026-09-30" })).items.map((r) => r.donorName)).toEqual(["마지막날"]);
    expect((await records(m, { q: "생일" })).total).toBe(11);
    expect((await records(m, { q: "팬2" })).items.map((r) => r.donorName)).toEqual(["팬23", "팬22", "팬21", "팬20", "팬2"]);
    expect((await records(m, { source: "flextv" })).total).toBe(0);
    // Bad filters fall back instead of failing.
    expect(await records(m, { source: "__proto__", from: "2026-02-30", to: "x", page: -3 })).toMatchObject({ source: "all", from: null, to: null, page: 1, total: 25 });
  });

  it("exports the records with formula-looking text escaped, and keeps them as sent", async () => {
    const m = await load();
    const evil = ["일시,닉네임,금액,메시지", '2026-09-01 10:00,"=HYPERLINK(""http://x"",""y"")",1000,=1+1', "2026-09-01 10:01,+cmd,1000,-2", "2026-09-01 10:02,@SUM(A1),1000,보통 메시지", "2026-09-01 10:03,-10,1000,"].join(
      "\n"
    );
    await importCsv(m, evil, 1);
    expect((await records(m)).items.map((r) => r.donorName)).toEqual(["-10", "@SUM(A1)", "+cmd", '=HYPERLINK("http://x","y")']);
    const out = await m.exportImportedDonationsCsv({});
    if (out.status !== "OK") throw new Error(out.status);
    expect(out).toMatchObject({ rows: 4, truncated: false });
    expect(out.filename).toMatch(/^ssumnation-imported-donations-\d{4}-\d{2}-\d{2}\.csv$/);
    const lines = out.csv.replace(/^﻿/, "").split("\r\n");
    expect(lines[0]).toBe("후원 일시 (한국 시간),출처,후원자 닉네임,금액,단위,메시지,유형");
    expect(lines).toContain("2026-09-01 10:03:00,투네이션,'-10,1000,원,,");
    expect(lines).toContain("2026-09-01 10:02:00,투네이션,'@SUM(A1),1000,원,보통 메시지,");
    expect(lines).toContain("2026-09-01 10:01:00,투네이션,'+cmd,1000,원,'-2,");
    expect(lines).toContain(`2026-09-01 10:00:00,투네이션,"'=HYPERLINK(""http://x"",""y"")",1000,원,'=1+1,`);
    // No cell starts a formula.
    expect(lines.slice(1).flatMap((l) => l.split(",")).some((c) => /^"?[=+\-@]/.test(c))).toBe(false);
  });
});

describe("FlexTV 후원 내역", () => {
  beforeEach(() => resetMockStores());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const link = async (m: M, handle = "flexman") => expect(await m.chat.connectBroadcastChannel({ platform: "FLEXTV", handle })).toEqual({ status: "OK" });

  it("needs the linked FlexTV account (the 통합 채팅 · 후원 연동 link)", async () => {
    const m = await load();
    expect(await m.syncFlexTvDonations()).toEqual({ status: "NOT_LINKED" });
    expect((await m.getDonationImportOverview())!.flextv).toEqual({ supported: true, unverified: true, linked: null, lastSyncAt: null, lastResult: null, lastError: null });
    await link(m);
    expect((await m.getDonationImportOverview())!.flextv.linked).toEqual({ handle: "flexman", title: "flexman 채널" });
  });

  it("pages through the history, then only takes what is new by External Transaction ID", async () => {
    const m = await load();
    await link(m);
    const first = await m.syncFlexTvDonations();
    expect(first).toMatchObject({ status: "OK", imported: 45, duplicates: 0, skipped: 0, hasMore: false });
    const all = await records(m, { source: "flextv" });
    expect(all.total).toBe(45);
    expect(all.items.every((r) => r.source === "FLEXTV" && r.unit === "KRW" && r.amount > 0)).toBe(true);
    const flex = (await m.getDonationImportOverview())!.flextv;
    expect(flex).toMatchObject({ lastResult: { imported: 45, duplicates: 0, skipped: 0, hasMore: false }, lastError: null });
    expect(flex.lastSyncAt).not.toBeNull();

    expect(await m.syncFlexTvDonations()).toMatchObject({ status: "OK", imported: 0, duplicates: 0 });

    const channel = m.channelsStore().channels.FLEXTV!.externalChannelId;
    const history = m.remote.flexHistoryOf(channel);
    const gift = (no: number, extra = {}) => ({ giftNo: no, sender: { id: "fx-new", nick: "새팬" }, price: 3_000, currency: "KRW", memo: "처음 후원해요", giftedAt: "2026-10-15T20:00:00+09:00", ...extra });
    m.remote.mockFlexHistoryAppend(channel, gift(1));
    m.remote.mockFlexHistoryAppend(channel, { ...history[0] }); // FlexTV delivers an old one again
    m.remote.mockFlexHistoryAppend(channel, gift(2, { price: "abc" })); // unreadable
    m.remote.mockFlexHistoryAppend(channel, gift(3, { sender: { id: "x", nick: "  " } })); // no donor name
    m.remote.mockFlexHistoryAppend(channel, gift(4, { price: 7.5, currency: undefined })); // FlexTV's own unit (TBD)
    expect(await m.syncFlexTvDonations()).toMatchObject({ status: "OK", imported: 2, duplicates: 1, skipped: 2 });
    const latest = await records(m, { source: "flextv", q: "새팬" });
    expect(latest.items.map((r) => [r.amount, r.unit])).toEqual(
      expect.arrayContaining([
        [3_000, "KRW"],
        [7.5, "FLEXTV_UNIT"]
      ])
    );
    expect(m.core.importStore().batches.map((b) => [b.source, b.imported, b.invalid, b.duplicates, b.channelHandle])).toEqual([
      ["FLEXTV", 45, 0, 0, "flexman"],
      ["FLEXTV", 2, 2, 1, "flexman"]
    ]);
  });

  it("stops after 10 pages (sample value) and continues on the next press", async () => {
    const m = await load();
    await link(m);
    const channel = m.channelsStore().channels.FLEXTV!.externalChannelId;
    for (let i = 0; i < 200; i++) m.remote.mockFlexHistoryAppend(channel, { giftNo: 9_000_000 + i, sender: { id: `p${i}`, nick: `팬${i}` }, price: 1_000, currency: "KRW", memo: "", giftedAt: "2026-10-10T10:00:00+09:00" });
    expect(await m.syncFlexTvDonations()).toMatchObject({ status: "OK", imported: 200, hasMore: true });
    expect((await m.getDonationImportOverview())!.flextv.lastResult).toMatchObject({ hasMore: true });
    expect(await m.syncFlexTvDonations()).toMatchObject({ status: "OK", imported: 45, hasMore: false });
  });

  it("reports an API failure and keeps what came before it; a retry continues from there", async () => {
    const m = await load();
    await link(m);
    m.remote.mockFailNextHistoryCall("FLEXTV", "UNAVAILABLE");
    expect(await m.syncFlexTvDonations()).toEqual({ status: "FAILED", code: "UNAVAILABLE", message: "FlexTV에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.", imported: 0, duplicates: 0, skipped: 0 });
    expect(m.core.importStore().records).toHaveLength(0);
    expect((await m.getDonationImportOverview())!.flextv).toMatchObject({ lastSyncAt: null, lastError: "UNAVAILABLE" });

    m.remote.mockFailNextHistoryCall("FLEXTV", "TIMEOUT", 1);
    expect(await m.syncFlexTvDonations()).toMatchObject({ status: "FAILED", code: "TIMEOUT", imported: 20 });
    expect((await m.getDonationImportOverview())!.flextv).toMatchObject({ lastError: "TIMEOUT", lastResult: { imported: 20, hasMore: true } });
    expect(await m.syncFlexTvDonations()).toMatchObject({ status: "OK", imported: 25, duplicates: 0 });
    expect((await m.getDonationImportOverview())!.flextv.lastError).toBeNull();
  });

  it("times out a FlexTV call that never answers (5 s)", async () => {
    const m = await load();
    await link(m);
    vi.useFakeTimers();
    m.remote.mockFailNextHistoryCall("FLEXTV", "HANG");
    const pending = m.syncFlexTvDonations();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(await pending).toMatchObject({ status: "FAILED", code: "TIMEOUT", message: "FlexTV 응답이 늦어요. 잠시 후 다시 시도해 주세요." });
  });

  it("says when FlexTV cannot give the history (capability not declared, or refused by the platform)", async () => {
    const m = await load();
    await link(m);
    const adapter = m.ADAPTERS.FLEXTV as { capabilities: readonly string[] };
    const declared = adapter.capabilities;
    adapter.capabilities = declared.filter((c) => c !== "DONATION_HISTORY");
    expect(await m.syncFlexTvDonations()).toEqual({ status: "UNSUPPORTED" });
    expect((await m.getDonationImportOverview())!.flextv.supported).toBe(false);
    adapter.capabilities = declared;
    m.remote.mockFailNextHistoryCall("FLEXTV", "UNSUPPORTED");
    expect(await m.syncFlexTvDonations()).toEqual({ status: "UNSUPPORTED" });
  });

  it("runs one sync at a time, and drops a read whose FlexTV link changed meanwhile", async () => {
    const m = await load();
    await link(m);
    const real = m.ADAPTERS.FLEXTV.fetchReceivedDonations.bind(m.ADAPTERS.FLEXTV);
    let nested: unknown;
    const spy = vi.spyOn(m.ADAPTERS.FLEXTV, "fetchReceivedDonations").mockImplementationOnce(async (...args) => {
      nested = await m.syncFlexTvDonations();
      return real(...args);
    });
    expect(await m.syncFlexTvDonations()).toMatchObject({ status: "OK", imported: 45 });
    expect(nested).toEqual({ status: "IN_PROGRESS" });

    spy.mockImplementationOnce(async (...args) => {
      await m.chat.connectBroadcastChannel({ platform: "FLEXTV", handle: "another_channel" });
      return real(...args);
    });
    expect(await m.syncFlexTvDonations()).toMatchObject({ status: "FAILED", code: "CHANNEL_CHANGED", imported: 0 });
    expect(m.core.importStore().records).toHaveLength(45);
    // The new channel starts from the beginning of its own history.
    expect(await m.syncFlexTvDonations()).toMatchObject({ status: "OK", imported: 45 });
  });

  it("keeps imported records when FlexTV is unlinked (기본값 — TBD); 되돌리기 removes a sync batch", async () => {
    const m = await load();
    await link(m);
    await m.syncFlexTvDonations();
    expect(await m.chat.disconnectBroadcastChannel({ platform: "FLEXTV" })).toEqual({ status: "OK" });
    expect((await records(m, { source: "flextv" })).total).toBe(45);
    const overview = (await m.getDonationImportOverview())!;
    expect(overview.flextv).toMatchObject({ linked: null, lastSyncAt: null });
    expect(await m.undoDonationImport({ batchId: overview.batches[0].id })).toEqual({ status: "UNDONE", removed: 45 });
    // Linked again: the read position stays, so the removed ones are not taken again.
    await link(m);
    expect(await m.syncFlexTvDonations()).toMatchObject({ status: "OK", imported: 0 });
  });
});

describe("내역 이관 · 권한", () => {
  beforeEach(() => resetMockStores());

  it("is creator-only: a supporter or a signed-out visitor reads nothing and changes nothing", async () => {
    const m = await load();
    const p = await preview(m);
    await importCsv(m, CSV, 1);
    const batchId = m.core.importStore().batches[0].id;
    for (const roles of [["SUPPORTER"] as const, null]) {
      signIn(roles ? [...roles] : null);
      expect(await m.getDonationImportOverview()).toBeNull();
      expect(await m.getImportedDonations({})).toBeNull();
      expect(await m.previewToonationCsv(form(CSV))).toEqual({ status: "UNAUTHORIZED" });
      expect(await m.remapToonationCsv({ previewId: p.previewId, mapping: p.mapping })).toEqual({ status: "UNAUTHORIZED" });
      expect(await m.importToonationCsv({ previewId: p.previewId, mapping: p.mapping, requestId: key(9) })).toEqual({ status: "UNAUTHORIZED" });
      expect(await m.undoDonationImport({ batchId })).toEqual({ status: "UNAUTHORIZED" });
      expect(await m.syncFlexTvDonations()).toEqual({ status: "UNAUTHORIZED" });
      expect(await m.exportImportedDonationsCsv({})).toEqual({ status: "UNAUTHORIZED" });
    }
    signIn();
    expect((await records(m)).total).toBe(3);
  });
});

describe("내역 이관 · 다른 기록과 분리", () => {
  beforeEach(() => resetMockStores());
  afterEach(() => vi.useRealTimers());

  it("never changes FN, wallets, earnings, settlement, 등급 · 칭호 or the FN rankings; the 수단별 보드 gets sums only", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-16T12:00:00+09:00"));
    const m = await load();
    const { getSupporterIdentity } = await import("@/services/supporter/identity");
    const { getMyRanking } = await import("@/services/supporter/ranking");
    const { getSupporterRanking } = await import("@/services/hallOfFame/supporterRanking");
    const { getDashboardSummary, getRevenueOverview } = await import("@/services/creator/creatorStudio");
    const { getDonorRanking, getReceivedDonations, getTitleTiers } = await import("./donationManagement");
    const { parseListPeriod } = await import("./donationManagementTypes");
    const { getOverlayWidget } = await import("./widgetOverlay");
    const { widgetStore } = await import("./widgetStore");
    const { mockCreator } = await import("./mockCreatorStore");
    const { mockAccount } = await import("@/services/account/mockStore");
    const { mockWallet } = await import("@/services/wallet/mockWalletStore");
    const { mockSettlement } = await import("./mockSettlementStore");
    const overlay = async (board: "DONOR" | "SOURCE" | "CREW") => {
      widgetStore.RANKING.board = board;
      widgetStore.RANKING.period = "전체";
      return getOverlayWidget("ranking", mockCreator.integrationKey);
    };
    const snapshot = async () =>
      structuredClone({
        identity: await getSupporterIdentity(),
        myRanking: await getMyRanking("all"),
        hallOfFame: await getSupporterRanking("all"),
        dashboard: await getDashboardSummary(),
        revenue: await getRevenueOverview(),
        titles: await getTitleTiers(),
        donorRanking: await getDonorRanking("season"),
        received: await getReceivedDonations({ kind: "game", period: parseListPeriod({}), status: "ALL", query: "", page: 1 }),
        fn: mockAccount.fnBalance,
        wallet: mockWallet,
        settlement: mockSettlement,
        donorBoard: await overlay("DONOR"),
        crewBoard: await overlay("CREW")
      });
    const sourceBefore = await overlay("SOURCE");
    const before = await snapshot();

    await importCsv(m, CSV, 1);
    await m.chat.connectBroadcastChannel({ platform: "FLEXTV", handle: "flexman" });
    expect(await m.syncFlexTvDonations()).toMatchObject({ status: "OK", imported: 45 });

    expect(await snapshot()).toEqual(before);
    const source = await overlay("SOURCE");
    if (source === "FORBIDDEN" || source.widget !== "ranking" || sourceBefore === "FORBIDDEN" || sourceBefore.widget !== "ranking") throw new Error("overlay");
    const flexTotal = (await records(m, { source: "flextv" })).totals[0].value;
    const imported = source.rows.filter((r) => r.name.includes("이관"));
    expect(imported).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "FlexTV 이관 · 45건", fnAmount: 0, amountLabel: `₩${flexTotal.toLocaleString("ko-KR")}` }),
        expect.objectContaining({ name: "투네이션 이관 · 3건", fnAmount: 0, amountLabel: "₩16,000" })
      ])
    );
    // The rows that were there before are unchanged (same names and amounts), and no donor name reaches the overlay.
    for (const row of sourceBefore.rows) expect(source.rows).toContainEqual(expect.objectContaining({ name: row.name, amountLabel: row.amountLabel }));
    const json = JSON.stringify(source);
    for (const name of ["별빛소나기", "새벽라디오", "콩떡이", ...(await records(m, { source: "flextv" })).items.map((r) => r.donorName)]) expect(json).not.toContain(name);
  });
});

describe("회원 탈퇴", () => {
  beforeEach(async () => {
    resetMockStores();
    const { settleSamplePlatformDonations, settleSampleCharges } = await import("@/test/mockEnv");
    await settleSamplePlatformDonations();
    await settleSampleCharges();
  });

  it("deletes the imported records, batches, waiting previews and the FlexTV position with the account; the trail stays", async () => {
    const m = await load();
    await importCsv(m, CSV, 1);
    await preview(m);
    await m.chat.connectBroadcastChannel({ platform: "FLEXTV", handle: "flexman" });
    await m.syncFlexTvDonations();
    expect(m.core.importStore().records).toHaveLength(48);

    const { decideReceivedQuest } = await import("./donationManagement");
    for (const id of ["q1", "q2"]) expect(await decideReceivedQuest({ id, outcome: "CANCELED" })).toMatchObject({ status: "OK" });
    const { getWithdrawalInfo, withdrawAccount } = await import("@/services/account/withdrawal");
    const info = (await getWithdrawalInfo())!;
    expect(
      await withdrawAccount({ requestId: key(77), confirmed: true, forfeitAgreed: true, fnBalance: info.fnBalance, unsettledFn: info.unsettledFn, earningsForfeitAgreed: true, password: "password" })
    ).toEqual({ status: "WITHDRAWN" });

    const s = m.core.importStore();
    expect(s.records).toEqual([]);
    expect(s.batches).toEqual([]);
    expect(s.previews).toEqual({});
    expect(s.requests).toEqual({});
    expect(s.flextv).toMatchObject({ channelId: null, cursor: null, lastSyncAt: null });
    expect(s.trail.map((t) => t.action)).toEqual(["CSV_IMPORT", "FLEXTV_SYNC"]);
  });
});
