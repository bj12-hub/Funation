import { describe, expect, it } from "vitest";
import { PARSERS } from "./widgetParsers";
import { defaultWidgetSettings } from "./widgetStore";

describe("위젯 기본 기간", () => {
  it("starts 후원목표 on this month and 총 후원 금액 on this year, on the Korean calendar", () => {
    // 2027-01-31 23:30 UTC is 2027-02-01 08:30 in Korea.
    const d = defaultWidgetSettings(new Date("2027-01-31T23:30:00Z"));
    expect([d.GOAL.from, d.GOAL.to]).toEqual(["2027-02-01", "2027-02-28"]);
    expect([d.TOTAL.from, d.TOTAL.to]).toEqual(["2027-01-01T00:00", "2027-12-31T23:59"]);
    expect(defaultWidgetSettings(new Date("2028-02-10T03:00:00Z")).GOAL.to).toBe("2028-02-29");
    expect(defaultWidgetSettings(new Date("2026-11-02T03:00:00Z")).GOAL).toMatchObject({ from: "2026-11-01", to: "2026-11-30" });
    // The settings form saves them as they are.
    expect(typeof PARSERS.GOAL(d.GOAL)).toBe("object");
    expect(typeof PARSERS.TOTAL(d.TOTAL)).toBe("object");
  });
});
