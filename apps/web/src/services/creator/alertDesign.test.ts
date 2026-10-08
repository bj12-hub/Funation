import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 후원 알림 디자인 (위젯 → 후원 알림): saved like the other widgets, read by the OBS alert overlay with its theme. */
async function load() {
  const widgets = await import("./widgetSettings");
  const remote = await import("./alertRemote");
  const theme = await import("./overlayTheme");
  const { mockCreator } = await import("./mockCreatorStore");
  return { ...widgets, ...remote, ...theme, overlayKey: mockCreator.integrationKey };
}

const design = {
  theme: "GLASS",
  layout: "BANNER",
  headline: "{닉네임}님 {금액} 감사해요",
  showMessage: false,
  showBadges: true,
  showPlatform: false,
  showImage: true,
  motion: "SLIDE_UP",
  countUp: false
};

describe("후원 알림 디자인", () => {
  beforeEach(() => resetMockStores());

  it("opens with the defaults, the real overlay address and the 전체 테마", async () => {
    const m = await load();
    const detail = await m.getWidgetDetail("ALERT");
    expect(detail).toMatchObject({
      key: "ALERT",
      overlayPath: `/overlay/alert/${m.overlayKey}`,
      settings: { theme: "INHERIT", layout: "CARD", headline: "{닉네임}님, 고마워요!", motion: "POP", countUp: true },
      live: { appearance: { theme: "PILL", accent: null } }
    });
  });

  it("saves a design the overlay then draws, resolving 전체 테마 따르기", async () => {
    const m = await load();
    let overlay = await m.getOverlayAlert(m.overlayKey);
    if (overlay === "FORBIDDEN") throw new Error("forbidden");
    expect(overlay.design.layout).toBe("CARD");
    expect(overlay.theme).toMatchObject({ theme: "PILL" });

    expect(await m.saveOverlayAppearance({ theme: "BOLD", accent: null })).toEqual({ status: "SAVED" });
    overlay = await m.getOverlayAlert(m.overlayKey);
    if (overlay === "FORBIDDEN") throw new Error("forbidden");
    expect(overlay.theme).toMatchObject({ theme: "BOLD", accentInk: "#111111" });

    expect(await m.saveWidgetSettings("ALERT", { ...design, headline: "  {닉네임}님 {금액} 감사해요 " })).toEqual({ status: "SAVED" });
    overlay = await m.getOverlayAlert(m.overlayKey);
    if (overlay === "FORBIDDEN") throw new Error("forbidden");
    expect(overlay.design).toEqual(design);
    expect(overlay.theme.theme).toBe("GLASS");
  });

  it("refuses a headline without {닉네임}, unknown choices and non-creators", async () => {
    const m = await load();
    expect(await m.saveWidgetSettings("ALERT", { ...design, headline: "감사합니다" })).toMatchObject({ status: "INVALID" });
    expect(await m.saveWidgetSettings("ALERT", { ...design, headline: `{닉네임}${"가".repeat(40)}` })).toMatchObject({ status: "INVALID" });
    expect(await m.saveWidgetSettings("ALERT", { ...design, layout: "POSTER" })).toMatchObject({ status: "INVALID" });
    expect(await m.saveWidgetSettings("ALERT", { ...design, motion: "tada" })).toMatchObject({ status: "INVALID" });
    expect(await m.saveWidgetSettings("ALERT", { ...design, theme: "NEON" })).toMatchObject({ status: "INVALID" });
    expect(await m.saveWidgetSettings("ALERT", { ...design, countUp: "yes" })).toMatchObject({ status: "INVALID" });
    signIn(["SUPPORTER"]);
    expect(await m.saveWidgetSettings("ALERT", design)).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.getWidgetDetail("ALERT")).toBeNull();
  });
});
