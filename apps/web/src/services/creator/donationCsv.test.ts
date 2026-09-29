import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

const wide = { from: "2000-01-01", to: "2099-12-31" };

/** 후원 리스트 CSV (code-first): same filters as the list, all pages, spreadsheet-safe cells. */
describe("후원 리스트 CSV", () => {
  beforeEach(() => resetMockStores());

  it("exports every matching row with a BOM and a header, matching the list total", async () => {
    const { exportReceivedDonationsCsv, getReceivedDonations } = await import("./donationManagement");
    const res = await exportReceivedDonationsCsv({ kind: "quest", period: wide, status: "SUCCESS", query: "" });
    if (res.status !== "OK") throw new Error(res.status);
    const list = (await getReceivedDonations({ kind: "quest", period: { preset: "range", ...wide }, status: "SUCCESS", query: "", page: 1 }))!;
    expect(res.csv.startsWith("﻿\"후원일시\"")).toBe(true);
    const lines = res.csv.split("\r\n");
    expect(lines).toHaveLength(list.total + 1);
    expect(res.rows).toBe(list.total);
    expect(lines.slice(1).every((l) => l.endsWith('"성공"'))).toBe(true);
    expect(res.filename).toBe("somnation-donations-quest-2000-01-01_2099-12-31.csv");
  });

  it("filters by donor search and rejects bad periods and non-creators", async () => {
    const { exportReceivedDonationsCsv } = await import("./donationManagement");
    const res = await exportReceivedDonationsCsv({ kind: "quest", period: wide, status: "ALL", query: "choco" });
    if (res.status !== "OK") throw new Error(res.status);
    expect(res.csv.split("\r\n").slice(1).every((l) => l.includes("choco_pie"))).toBe(true);
    expect(await exportReceivedDonationsCsv({ kind: "quest", period: { from: "2026-02-01", to: "2026-01-01" }, status: "ALL", query: "" })).toEqual({ status: "INVALID" });
    signIn(["SUPPORTER"]);
    expect(await exportReceivedDonationsCsv({ kind: "quest", period: wide, status: "ALL", query: "" })).toEqual({ status: "UNAUTHORIZED" });
  });
});
