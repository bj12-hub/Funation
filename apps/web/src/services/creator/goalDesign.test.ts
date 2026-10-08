import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import { DEFAULT_WIDGET_SETTINGS } from "./widgetSettingsTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 후원목표 (2026-10-08): 오버레이 테마, 목표 모양 and a 두 번째 목표 shown in turn. */
async function load() {
  const widgets = await import("./widgetSettings");
  const overlay = await import("./widgetOverlay");
  const theme = await import("./overlayTheme");
  const store = await import("./widgetStore");
  const { mockCreator } = await import("./mockCreatorStore");
  return { ...widgets, ...overlay, ...theme, ...store, overlayKey: mockCreator.integrationKey };
}

const goal = { ...DEFAULT_WIDGET_SETTINGS.GOAL, from: "2026-01-01", to: "2099-12-31" };

describe("후원목표 모양 · 두 번째 목표", () => {
  beforeEach(() => resetMockStores());

  it("sends the second goal's progress and the goal's own theme to the overlay", async () => {
    const m = await load();
    let read = await m.getOverlayWidget("goal", m.overlayKey);
    if (read === "FORBIDDEN" || read.widget !== "goal") throw new Error("no goal");
    expect(read.second).toBeNull();
    expect(read.theme.theme).toBe("PILL");

    const saved = { ...goal, shape: "HEART", theme: "GLASS", startAmount: 0, goalAmount: 100_000, second: { enabled: true, title: "이번 달 장기 목표", startAmount: 50_000, goalAmount: 1_000_000 }, alternateSec: 8 };
    expect(await m.saveWidgetSettings("GOAL", saved)).toEqual({ status: "SAVED" });
    read = await m.getOverlayWidget("goal", m.overlayKey);
    if (read === "FORBIDDEN" || read.widget !== "goal") throw new Error("no goal");
    expect(read.settings).toMatchObject({ shape: "HEART", alternateSec: 8, second: { enabled: true, title: "이번 달 장기 목표" } });
    expect(read.theme.theme).toBe("GLASS");
    // Same donations for both goals, each with its own start and target.
    const donated = read.current - 0;
    expect(read.second).toEqual({ current: 50_000 + donated, percent: Math.round(Math.min(100, ((50_000 + donated) / 1_000_000) * 100) * 10) / 10 });
  });

  it("validates the shape and the second goal, and keeps a payload from before the redesign working", async () => {
    const m = await load();
    expect(await m.saveWidgetSettings("GOAL", { ...goal, shape: "PYRAMID" })).toMatchObject({ status: "INVALID" });
    expect(await m.saveWidgetSettings("GOAL", { ...goal, theme: "NEON" })).toMatchObject({ status: "INVALID" });
    expect(await m.saveWidgetSettings("GOAL", { ...goal, alternateSec: 2 })).toMatchObject({ status: "INVALID" });
    expect(await m.saveWidgetSettings("GOAL", { ...goal, second: { enabled: true, title: "", startAmount: 0, goalAmount: 10 } })).toMatchObject({ status: "INVALID" });
    expect(await m.saveWidgetSettings("GOAL", { ...goal, second: { enabled: true, title: "장기", startAmount: 10, goalAmount: 10 } })).toMatchObject({ status: "INVALID" });
    // A second goal switched off keeps what was typed, without checking it.
    expect(await m.saveWidgetSettings("GOAL", { ...goal, second: { enabled: false, title: "", startAmount: 5, goalAmount: 1 } })).toEqual({ status: "SAVED" });

    // Saved by the popup before 오버레이 테마: no theme / shape / colors switch / second goal.
    const { theme: _t, shape: _s, customColors: _c, second: _g, alternateSec: _a, ...legacy } = goal;
    void [_t, _s, _c, _g, _a];
    expect(await m.saveWidgetSettings("GOAL", legacy)).toEqual({ status: "SAVED" });
    expect(m.readWidget("GOAL")).toMatchObject({ theme: "INHERIT", shape: "BAR", customColors: true, second: { enabled: false }, alternateSec: 10 });

    // A store written before these fields reads with them (its own colors kept).
    (m.widgetStore as Record<string, unknown>).GOAL = legacy;
    expect(m.readWidget("GOAL")).toMatchObject({ theme: "INHERIT", shape: "BAR", customColors: true, second: { enabled: false }, alternateSec: 10 });

    signIn(["SUPPORTER"]);
    expect(await m.saveWidgetSettings("GOAL", goal)).toEqual({ status: "UNAUTHORIZED" });
  });
});
