import { describe, expect, it } from "vitest";
import { isIsoDate, isIsoDateTime, parsePeriod } from "./period";
import { parseStatsPeriod } from "@/services/creator/creatorStats";
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

  it("does not save widget periods on impossible days", () => {
    const goal = DEFAULT_WIDGET_SETTINGS.GOAL;
    expect(typeof PARSERS.GOAL({ ...goal, from: "2026-02-30", to: "2026-03-31" })).toBe("string"); // error message
    expect(typeof PARSERS.GOAL({ ...goal, from: "2026-03-01", to: "2026-03-31" })).toBe("object");
    const total = DEFAULT_WIDGET_SETTINGS.TOTAL;
    expect(typeof PARSERS.TOTAL({ ...total, from: "2026-02-30T00:00", to: "2026-03-31T23:59" })).toBe("string");
  });
});
