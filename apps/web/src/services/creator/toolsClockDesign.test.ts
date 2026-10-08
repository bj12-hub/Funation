import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import { DEFAULT_WIDGET_SETTINGS } from "./widgetSettingsTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 방송 도구 테마 and the 시계 widget (2026-10-08 오버레이 테마). */
async function load() {
  const tools = await import("./broadcastTools");
  const widgets = await import("./widgetSettings");
  const overlay = await import("./widgetOverlay");
  const theme = await import("./overlayTheme");
  const { mockCreator } = await import("./mockCreatorStore");
  return { ...tools, ...widgets, ...overlay, ...theme, key: mockCreator.integrationKey };
}

describe("방송 도구 테마", () => {
  beforeEach(() => resetMockStores());

  it("follows the 전체 테마 until the creator picks one for every tool overlay", async () => {
    const m = await load();
    expect((await m.getToolsView())!.theme).toBe("INHERIT");
    await m.saveOverlayAppearance({ theme: "GLASS", accent: null });
    let read = await m.getOverlayTool("subtitle", m.key);
    if (read === "FORBIDDEN") throw new Error("forbidden");
    expect(read.theme.theme).toBe("GLASS");

    expect(await m.saveToolTheme("BOLD")).toEqual({ status: "SAVED" });
    expect((await m.getToolsView())!.theme).toBe("BOLD");
    for (const tool of ["subtitle", "marquee", "timer", "credits", "bingo"] as const) {
      read = await m.getOverlayTool(tool, m.key);
      if (read === "FORBIDDEN") throw new Error("forbidden");
      expect(read.theme.theme, tool).toBe("BOLD");
    }
    expect(await m.saveToolTheme("NEON")).toMatchObject({ status: "INVALID" });
    signIn(["SUPPORTER"]);
    expect(await m.saveToolTheme("PILL")).toEqual({ status: "UNAUTHORIZED" });
  });
});

describe("시계 위젯", () => {
  beforeEach(() => resetMockStores());

  it("saves the look and serves it at /overlay/widget/clock", async () => {
    const m = await load();
    const detail = await m.getWidgetDetail("CLOCK");
    expect(detail).toMatchObject({ key: "CLOCK", overlayPath: `/overlay/widget/clock/${m.key}`, settings: DEFAULT_WIDGET_SETTINGS.CLOCK });
    const look = { theme: "PILL", style: "ANALOG", hour12: true, showSeconds: false, showDate: true, label: "  방송 끝 11시 " };
    expect(await m.saveWidgetSettings("CLOCK", look)).toEqual({ status: "SAVED" });
    const read = await m.getOverlayWidget("clock", m.key);
    if (read === "FORBIDDEN" || read.widget !== "clock") throw new Error("no clock");
    expect(read.settings).toEqual({ ...look, label: "방송 끝 11시" });
    expect(read.theme.theme).toBe("PILL");
    expect(Date.parse(read.serverNow)).not.toBeNaN();
  });

  it("refuses unknown looks and long captions", async () => {
    const m = await load();
    const base = DEFAULT_WIDGET_SETTINGS.CLOCK;
    expect(await m.saveWidgetSettings("CLOCK", { ...base, style: "SUNDIAL" })).toMatchObject({ status: "INVALID" });
    expect(await m.saveWidgetSettings("CLOCK", { ...base, hour12: "yes" })).toMatchObject({ status: "INVALID" });
    expect(await m.saveWidgetSettings("CLOCK", { ...base, label: "가".repeat(21) })).toMatchObject({ status: "INVALID" });
    expect(await m.saveWidgetSettings("CLOCK", { ...base, theme: "NEON" })).toMatchObject({ status: "INVALID" });
  });
});
