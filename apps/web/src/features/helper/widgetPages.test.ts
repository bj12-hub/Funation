import { describe, expect, it } from "vitest";
import { EDITABLE_WIDGETS } from "@/services/creator/widgetSettingsTypes";
import { WIDGET_HELPER_PATH, WIDGET_PAGES, widgetPageOf } from "./widgetPages";

describe("도우미 widget pages", () => {
  it("give every editable widget exactly one page", () => {
    const keys = Object.values(WIDGET_PAGES).flatMap((p) => p.tabs.map((t) => t.key));
    expect([...keys].sort()).toEqual([...EDITABLE_WIDGETS].sort());
    for (const k of EDITABLE_WIDGETS) expect(WIDGET_HELPER_PATH[k]).toMatch(/^\/[a-z]+(\?tab=[a-z]+)?$/);
  });

  it("keep tab slugs unique within a page", () => {
    for (const page of Object.values(WIDGET_PAGES)) {
      const slugs = page.tabs.map((t) => t.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });

  it("only know their own features", () => {
    expect(widgetPageOf("goal")?.title).toBe("목표치");
    expect(widgetPageOf("constructor")).toBeNull();
    expect(widgetPageOf("wallet")).toBeNull();
  });
});
