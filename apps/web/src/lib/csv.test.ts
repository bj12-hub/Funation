import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores } from "@/test/mockEnv";
import { toCsv } from "./csv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/**
 * CSV downloads and formula injection: a cell a spreadsheet would run as a formula (= + - @ tab CR first) gets a
 * leading apostrophe, numbers the code passes stay numbers, and a cell with a separator is quoted. One helper
 * (lib/csv.ts) does it for every download of the site, the studio and the admin console.
 */

const lines = (csv: string) => csv.replace(/^﻿/, "").split("\r\n");

describe("toCsv", () => {
  it("prefixes text a spreadsheet would run as a formula, and leaves numbers the code passes as numbers", () => {
    const csv = toCsv(["텍스트", "숫자"], [["=1+1", -5], ["+82", 3], ["-2", 0], ["@SUM(A1)", 1.5], ["\t=1", 1], ["\r=1", 2], ["보통 a=b", 1_000], ["", 7]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(lines(csv)).toEqual(["텍스트,숫자", "'=1+1,-5", "'+82,3", "'-2,0", "'@SUM(A1),1.5", "\"'\t=1\",1", "\"'\r=1\",2", "보통 a=b,1000", ",7"]);
  });

  it("quotes a cell with a quote, a line break or a separator, so no part of it can start a cell of its own", () => {
    // A spreadsheet whose list separator is ";" (other locales), or an import split on tabs, would otherwise read
    // "=1+1" as a cell of its own.
    expect(lines(toCsv(["x"], [["별빛;=1+1"], ["별빛\t=1+1"], ['말 "안녕"'], ["두 줄\n=1+1"], ["a,b"]]))).toEqual([
      "x",
      '"별빛;=1+1"',
      '"별빛\t=1+1"',
      '"말 ""안녕"""',
      '"두 줄\n=1+1"',
      '"a,b"'
    ]);
  });

  it("quotes every cell when asked, still neutralizing formulas", () => {
    expect(lines(toCsv(["h"], [["=x"], [7], ["-"]], { quoteAll: true }))).toEqual(['"h"', "\"'=x\"", '"7"', "\"'-\""]);
  });
});

describe("CSV downloads", () => {
  beforeEach(() => resetMockStores());

  it("FN 후원내역: the supporter's message cannot run as a formula", async () => {
    const { requestDonation } = await import("@/services/donations/donate");
    const { mockAccount } = await import("@/services/account/mockStore");
    mockAccount.fnBalance = 100_000;
    const message = '=HYPERLINK("http://example.invalid","보기")';
    expect(await requestDonation({ creatorId: "c1", hideProfile: false, type: "TEXT", amount: 1_000, message, voiceId: null, idempotencyKey: key(1) })).toMatchObject({ status: "COMPLETED" });
    const { GET } = await import("@/app/api/wallet/donations/route");
    const csv = await (await GET({ nextUrl: new URL("http://localhost/api/wallet/donations?period=year") } as never)).text();
    const line = lines(csv).find((l) => l.includes("HYPERLINK"));
    expect(line).toContain(`"'=HYPERLINK(""http://example.invalid"",""보기"")",1000,`);
  });

  it("후원 리스트: donor names, ids and quest titles cannot run as formulas; amounts stay numbers", async () => {
    const { recordQuest } = await import("@/services/donations/questCore");
    const { STUDIO_CHANNEL } = await import("@/services/crew/mockCrewStore");
    recordQuest({
      id: "q-csv",
      channelId: STUDIO_CHANNEL,
      supporterUserId: null,
      donor: "=cmd|' /C calc'!A0",
      donorId: "-csv",
      title: "@SUM(1+1)",
      amount: 1_000,
      timeLimitSec: 600,
      creatorDecides: true,
      createdAt: new Date().toISOString()
    });
    const { exportReceivedDonationsCsv } = await import("@/services/creator/donationManagement");
    const res = await exportReceivedDonationsCsv({ kind: "quest", period: { from: "2000-01-01", to: "2099-12-31" }, status: "ALL", query: "" });
    if (res.status !== "OK") throw new Error(res.status);
    expect(lines(res.csv).find((l) => l.includes("calc"))).toContain(`,"'=cmd|' /C calc'!A0","'-csv","1000","'@SUM(1+1)",`);
  });
});

// ── Guard ───────────────────────────────────────────────────────────────────────────────────────────────────

const APPS = join(__dirname, "../../..");
const ROOTS = [join(APPS, "web/src"), join(APPS, "admin/src"), join(APPS, "../packages")];
/** A CSV content type or a `.csv` file name in the code: the file offers a CSV download. */
const OFFERS_CSV = /text\/csv|\.csv[`"']/;
/** A character class with = + @ (and so on): a formula check of its own. */
const FORMULA_CHECK = /\[(?=[^\]\n]*=)(?=[^\]\n]*\+)(?=[^\]\n]*@)[^\]\n]*\]/;
/** Files that offer a CSV they do not build themselves, and where it is built. */
const BUILT_ELSEWHERE: Record<string, string> = {
  "web/src/features/creatorStudio/donations/CsvExportButton.tsx": "saves the file exportReceivedDonationsCsv (donationManagement.ts) built",
  "web/src/features/creatorStudio/donations/ImportedCsvButton.tsx": "saves the file exportImportedDonationsCsv built (donationImportCore.ts importedCsv)",
  "web/src/features/creatorStudio/donations/ToonationImportCard.tsx": "the fixed SAMPLE_CSV (no user text) and the upload field",
  "web/src/services/creator/donationImport.ts": "names the file donationImportCore.ts importedCsv builds"
};

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name === "node_modules" || e.name.startsWith(".")) return [];
    const path = join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|js|mjs)$/.test(e.name) && !/\.test\.(ts|tsx)$/.test(e.name) ? [path] : [];
  });
}

describe("CSV downloads guard", () => {
  it("builds every CSV download with lib/csv.ts; no other file checks for formulas on its own", () => {
    const files = ROOTS.flatMap(sourceFiles).map((path) => ({ name: relative(APPS, path).replaceAll("\\", "/"), text: readFileSync(path, "utf8") }));
    expect(files.some((f) => f.name === "web/src/lib/csv.ts")).toBe(true);
    const offers = files.filter((f) => f.name !== "web/src/lib/csv.ts" && OFFERS_CSV.test(f.text));
    const unbuilt = offers.filter((f) => !/from "@\/lib\/csv"/.test(f.text) && !Object.hasOwn(BUILT_ELSEWHERE, f.name)).map((f) => f.name);
    expect(unbuilt, "CSV downloads not built with @/lib/csv (toCsv)").toEqual([]);
    // The list stays honest: every entry still offers a CSV.
    expect(Object.keys(BUILT_ELSEWHERE).filter((name) => !offers.some((f) => f.name === name))).toEqual([]);
    const ownChecks = files.filter((f) => f.name !== "web/src/lib/csv.ts" && FORMULA_CHECK.test(f.text)).map((f) => f.name);
    expect(ownChecks, "formula checks outside lib/csv.ts").toEqual([]);
  });
});
