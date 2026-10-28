import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 후원 알림 디자인 (위젯 → 후원 알림): saved like the other widgets, read by the OBS alert overlay with its theme. */
async function load() {
  const widgets = await import("./widgetSettings");
  const remote = await import("./alertRemote");
  const theme = await import("./overlayTheme");
  const assets = await import("./assets");
  const sigPlayer = await import("./sigPlayer");
  const { mockCreator } = await import("./mockCreatorStore");
  return { ...widgets, ...remote, ...theme, ...assets, ...sigPlayer, overlayKey: mockCreator.integrationKey };
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
    // A screen from before 알림 사운드 · 시그니처 음원 받는 방식 (2026-10-28) saves none · 기존 방식.
    expect(overlay.design).toEqual({ ...design, soundId: null, sigFetch: "CACHE" });
    expect(overlay.alertSound).toBeNull();
    expect(overlay.theme.theme).toBe("GLASS");
  });

  it("알림 사운드 · 시그니처 음원 받는 방식 (2026-10-28): a library sound for the overlay, the mode for both overlays", async () => {
    const m = await load();
    const fd = new FormData();
    fd.set("requestId", key(1));
    fd.set("file", new File([new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0, 0, 0])], "ding.mp3", { type: "audio/mpeg" }));
    const up = await m.uploadAsset(fd);
    if (up.status !== "SAVED") throw new Error(JSON.stringify(up));
    const obs = async () => {
      const overlay = await m.getOverlayAlert(m.overlayKey);
      if (overlay === "FORBIDDEN") throw new Error("forbidden");
      return overlay;
    };
    expect(await m.getWidgetDetail("ALERT")).toMatchObject({ settings: { soundId: null, sigFetch: "CACHE" } });

    expect(await m.saveWidgetSettings("ALERT", { ...design, soundId: up.asset.id, sigFetch: "FULL" })).toEqual({ status: "SAVED" });
    expect(await m.getWidgetDetail("ALERT")).toMatchObject({ settings: { soundId: up.asset.id, sigFetch: "FULL" } });
    expect(await obs()).toMatchObject({ alertSound: up.asset.url, design: { sigFetch: "FULL" } });
    const player = await m.getOverlaySigPlayer(m.overlayKey);
    expect(player !== "FORBIDDEN" && player.sigFetch).toBe("FULL");

    const bad: [Record<string, unknown>, string][] = [
      [{ soundId: "missing-id" }, "라이브러리에 없는 알림 사운드"],
      [{ soundId: "../x" }, "알림 사운드를 다시"],
      [{ soundId: 3 }, "알림 사운드를 다시"],
      [{ sigFetch: "STREAM" }, "시그니처 음원 받는 방식"]
    ];
    for (const [patch, message] of bad) {
      const res = await m.saveWidgetSettings("ALERT", { ...design, ...patch });
      expect(res.status === "INVALID" && res.message, message).toContain(message);
    }

    // Deleted from the library: none, on the screen and on OBS.
    await m.deleteAsset(up.asset.id);
    expect(await m.getWidgetDetail("ALERT")).toMatchObject({ settings: { soundId: null } });
    expect(await obs()).toMatchObject({ alertSound: null, design: { soundId: null } });
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
