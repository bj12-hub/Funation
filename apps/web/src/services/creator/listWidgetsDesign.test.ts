import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, resetMockStores } from "@/test/mockEnv";
import { DEFAULT_WIDGET_SETTINGS } from "./widgetSettingsTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 누적 · 랭킹 · 최근알림 · 이벤트 · QR (2026-10-08): 오버레이 테마 per widget and 배경 카드. */
async function load() {
  const widgets = await import("./widgetSettings");
  const overlay = await import("./widgetOverlay");
  const store = await import("./widgetStore");
  const { mockCreator } = await import("./mockCreatorStore");
  return { ...widgets, ...overlay, ...store, overlayKey: mockCreator.integrationKey };
}

const KINDS = [
  ["TOTAL", "total"],
  ["RANKING", "ranking"],
  ["RECENT", "recent"],
  ["EVENT", "event"],
  ["QR", "qr"]
] as const;

describe("후원 위젯 테마 · 배경 카드", () => {
  beforeEach(() => resetMockStores());

  it("starts on the theme card and sends each widget's own theme to its overlay", async () => {
    const m = await load();
    for (const [key, overlay] of KINDS) {
      const defaults = DEFAULT_WIDGET_SETTINGS[key];
      expect(defaults.theme, key).toBe("INHERIT");
      if ("card" in defaults) expect(defaults.card, key).toBe(true);
      expect(await m.saveWidgetSettings(key, { ...defaults, theme: "BOLD" }), key).toEqual({ status: "SAVED" });
      const read = await m.getOverlayWidget(overlay, m.overlayKey);
      if (read === "FORBIDDEN") throw new Error("forbidden");
      expect(read.theme.theme, key).toBe("BOLD");
    }
  });

  it("keeps settings from before the redesign as they looked (no card, 전체 테마)", async () => {
    const m = await load();
    for (const [key] of KINDS) {
      const { theme: _t, ...rest } = DEFAULT_WIDGET_SETTINGS[key] as { theme: string; card?: boolean };
      void _t;
      const legacy = { ...rest };
      delete legacy.card;
      // A payload from the old popup saves…
      expect(await m.saveWidgetSettings(key, legacy), key).toEqual({ status: "SAVED" });
      expect(m.readWidget(key), key).toMatchObject(key === "QR" || key === "EVENT" ? { theme: "INHERIT" } : { theme: "INHERIT", card: false });
      // …and a stored copy without the fields reads the same.
      (m.widgetStore as Record<string, unknown>)[key] = legacy;
      expect(m.readWidget(key), key).toMatchObject(key === "QR" || key === "EVENT" ? { theme: "INHERIT" } : { theme: "INHERIT", card: false });
    }
    expect(await m.saveWidgetSettings("TOTAL", { ...DEFAULT_WIDGET_SETTINGS.TOTAL, theme: "NEON" })).toMatchObject({ status: "INVALID" });
    expect(await m.saveWidgetSettings("RANKING", { ...DEFAULT_WIDGET_SETTINGS.RANKING, card: "yes" })).toMatchObject({ status: "INVALID" });
  });
});
