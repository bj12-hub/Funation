import { describe, expect, it } from "vitest";
import { parseHistoryParams } from "@/features/wallet/historyParams";
import { isIsoDate, isIsoDateTime, parsePeriod, presetRange } from "./period";
import { parseStatsPeriod, presetPeriod } from "@/services/creator/creatorStats";
import { parseListPeriod } from "@/services/creator/donationManagementTypes";
import { PARSERS } from "@/services/creator/widgetParsers";
import { DEFAULT_WIDGET_SETTINGS } from "@/services/creator/widgetSettingsTypes";

/**
 * Dates from URLs and forms must be real calendar days. `new Date("2026-02-30")` rolls over to 3월 2일 instead
 * of failing, so a format check plus "is it a number" let impossible days through.
 */
describe("날짜 검증", () => {
  it("accepts real days and rejects impossible or malformed ones", () => {
    for (const ok of ["2026-02-28", "2028-02-29", "2026-12-31", "2026-04-30"]) expect(isIsoDate(ok)).toBe(true);
    for (const bad of ["2026-02-29", "2026-02-30", "2026-04-31", "2026-13-01", "2026-00-10", "2026-1-01", "20260101", "", null, 20260101]) expect(isIsoDate(bad)).toBe(false);
    expect(isIsoDateTime("2026-10-05T23:59")).toBe(true);
    for (const bad of ["2026-02-30T10:00", "2026-10-05T24:00", "2026-10-05T10:60", "2026-10-05 10:00", "2026-10-05"]) expect(isIsoDateTime(bad)).toBe(false);
  });

  it("falls back to the default period instead of keeping an impossible day", () => {
    expect(parsePeriod({ period: "range", from: "2026-02-30", to: "2026-03-05" }).preset).toBe("month");
    expect(parseStatsPeriod({ period: "range", from: "2026-02-30", to: "2026-03-05" }).preset).toBe("week");
    expect(parseStatsPeriod({ period: "range", from: "2026-02-27", to: "2026-03-05" })).toEqual({ preset: "range", from: "2026-02-27", to: "2026-03-05" });
    expect(parseListPeriod({ period: "range", from: "2026-04-31", to: "2026-05-02" }).preset).toBe("1y");
  });

  it("ignores inherited object keys as presets and categories", () => {
    for (const key of ["__proto__", "constructor", "toString"]) {
      expect(parsePeriod({ period: key }).preset).toBe("month");
      expect(parseStatsPeriod({ period: key }).preset).toBe("week");
      expect(parseHistoryParams({ type: key }).category).toBe("basic");
    }
  });

  it("does not save widget periods on impossible days", () => {
    const goal = DEFAULT_WIDGET_SETTINGS.GOAL;
    expect(typeof PARSERS.GOAL({ ...goal, from: "2026-02-30", to: "2026-03-31" })).toBe("string"); // error message
    expect(typeof PARSERS.GOAL({ ...goal, from: "2026-03-01", to: "2026-03-31" })).toBe("object");
    const total = DEFAULT_WIDGET_SETTINGS.TOTAL;
    expect(typeof PARSERS.TOTAL({ ...total, from: "2026-02-30T00:00", to: "2026-03-31T23:59" })).toBe("string");
  });
});

/**
 * Calendar periods (2026-10-08 결정 "달력 기준"): 이번 주 / 1주일 / 주별 from Monday, 1개월 / 월별 from the 1st, N개월 from
 * the 1st of the month N − 1 back, 1년 / 연별 = 12 calendar months. Month ends no longer skip days (10-31 1개월 was 10-02).
 */
describe("달력 기준 기간", () => {
  const day = (iso: string) => new Date(`${iso}T15:00:00`);
  const table: [today: string, week: string, m1: string, m3: string, m6: string, y1: string][] = [
    ["2026-10-31", "2026-10-26", "2026-10-01", "2026-08-01", "2026-05-01", "2025-11-01"],
    ["2026-03-31", "2026-03-30", "2026-03-01", "2026-01-01", "2025-10-01", "2025-04-01"],
    ["2026-01-01", "2025-12-29", "2026-01-01", "2025-11-01", "2025-08-01", "2025-02-01"],
    ["2026-02-28", "2026-02-23", "2026-02-01", "2025-12-01", "2025-09-01", "2025-03-01"],
    ["2026-10-26", "2026-10-26", "2026-10-01", "2026-08-01", "2026-05-01", "2025-11-01"],
    ["2026-10-25", "2026-10-19", "2026-10-01", "2026-08-01", "2026-05-01", "2025-11-01"]
  ];

  it.each(table)("on %s", (today, week, m1, m3, m6, y1) => {
    const d = day(today);
    const list = (period?: string) => parseListPeriod({ period }, d).from;
    expect([list("1w"), list("1m"), list("3m"), list("6m"), list()]).toEqual([week, m1, m3, m6, y1]);
    expect(parseListPeriod({ period: "today" }, d)).toMatchObject({ from: today, to: today });
    const stats = (p: "week" | "month" | "3months" | "6months" | "year") => presetPeriod(p, d).from;
    expect([stats("week"), stats("month"), stats("3months"), stats("6months"), stats("year")]).toEqual([week, m1, m3, m6, y1]);
    expect(presetPeriod("today", d)).toMatchObject({ from: today, to: today });
    expect([presetRange("day", d).from, presetRange("week", d).from, presetRange("month", d).from, presetRange("year", d).from]).toEqual([today, week, m1, y1]);
    expect(presetRange("month", d).to).toBe(today);
  });
});
