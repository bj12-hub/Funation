import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, resetMockStores } from "@/test/mockEnv";
import { DEFAULT_WIDGET_SETTINGS } from "./widgetSettingsTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 퀘스트 · 투표 · 룰렛 · 뽑기 · 당첨 리스트 · 벽지 (2026-10-08): each overlay draws in its widget's 오버레이 테마. */
async function load() {
  const widgets = await import("./widgetSettings");
  const overlay = await import("./widgetOverlay");
  const store = await import("./widgetStore");
  const { mockCreator } = await import("./mockCreatorStore");
  return { ...widgets, ...overlay, ...store, overlayKey: mockCreator.integrationKey };
}

describe("게임 · 이벤트 위젯 테마", () => {
  beforeEach(() => resetMockStores());

  it("sends each widget's own theme to its overlay (뽑기 and its 당첨 리스트 share one)", async () => {
    const m = await load();
    const cases = [
      ["QUEST", "quest", { ...DEFAULT_WIDGET_SETTINGS.QUEST, theme: "BOLD" }],
      ["VOTE", "vote", { ...DEFAULT_WIDGET_SETTINGS.VOTE, theme: "GLASS" }],
      ["ROULETTE", "roulette", { ...DEFAULT_WIDGET_SETTINGS.ROULETTE, theme: "BOLD" }],
      ["WALLPAPER", "wallpaper", { ...DEFAULT_WIDGET_SETTINGS.WALLPAPER, theme: "GLASS" }]
    ] as const;
    for (const [key, overlay, settings] of cases) {
      expect(await m.saveWidgetSettings(key, settings), key).toEqual({ status: "SAVED" });
      const read = await m.getOverlayWidget(overlay, m.overlayKey);
      if (read === "FORBIDDEN") throw new Error("forbidden");
      expect(read.theme.theme, key).toBe(settings.theme);
    }
    expect(await m.saveWidgetSettings("GACHA", { ...DEFAULT_WIDGET_SETTINGS.GACHA, overlayTheme: "BOLD" })).toEqual({ status: "SAVED" });
    for (const overlay of ["gacha", "gacha-board"] as const) {
      const read = await m.getOverlayWidget(overlay, m.overlayKey);
      if (read === "FORBIDDEN") throw new Error("forbidden");
      expect(read.theme.theme, overlay).toBe("BOLD");
    }
    expect(await m.saveWidgetSettings("GACHA", { ...DEFAULT_WIDGET_SETTINGS.GACHA, overlayTheme: "NEON" })).toMatchObject({ status: "INVALID" });
  });

  it("reads settings saved before the redesign as 전체 테마 따르기", async () => {
    const m = await load();
    for (const key of ["QUEST", "VOTE", "ROULETTE", "WALLPAPER"] as const) {
      const legacy = { ...(DEFAULT_WIDGET_SETTINGS[key] as Record<string, unknown>) };
      delete legacy.theme;
      (m.widgetStore as Record<string, unknown>)[key] = legacy;
      expect((m.readWidget(key) as { theme: string }).theme, key).toBe("INHERIT");
    }
    const gacha = { ...(DEFAULT_WIDGET_SETTINGS.GACHA as Record<string, unknown>) };
    delete gacha.overlayTheme;
    (m.widgetStore as Record<string, unknown>).GACHA = gacha;
    expect(m.readWidget("GACHA").overlayTheme).toBe("INHERIT");
    // The old popup's payload (no theme) still saves.
    expect(await m.saveWidgetSettings("GACHA", gacha)).toEqual({ status: "SAVED" });
  });
});
