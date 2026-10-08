import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import { THEME_DEFAULT_ACCENT, effectLabel, readableInk, resolveTheme } from "./overlayThemeTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 오버레이 테마: the channel's 전체 테마 and 포인트 색상, read by every overlay. */
async function load() {
  const actions = await import("./overlayTheme");
  const store = await import("./overlayThemeStore");
  return { ...actions, ...store };
}

describe("overlay theme", () => {
  beforeEach(() => resetMockStores());

  it("starts on 미니멀 필 with the theme's own accent and saves the creator's choice", async () => {
    const m = await load();
    expect(await m.getOverlayAppearance()).toEqual({ theme: "PILL", accent: null });
    expect(m.overlayTheme()).toEqual({ theme: "PILL", accent: THEME_DEFAULT_ACCENT.PILL, accentInk: "#FFFFFF" });

    expect(await m.saveOverlayAppearance({ theme: "BOLD", accent: "#ffd23f" })).toEqual({ status: "SAVED" });
    expect(await m.getOverlayAppearance()).toEqual({ theme: "BOLD", accent: "#FFD23F" });
    // A widget that follows the 전체 테마, and one that picked its own.
    expect(m.overlayTheme("INHERIT")).toMatchObject({ theme: "BOLD", accent: "#FFD23F", accentInk: "#111111" });
    expect(m.overlayTheme("GLASS")).toMatchObject({ theme: "GLASS", accent: "#FFD23F" });

    expect(await m.saveOverlayAppearance({ theme: "GLASS", accent: null })).toEqual({ status: "SAVED" });
    expect(m.overlayTheme()).toMatchObject({ theme: "GLASS", accent: THEME_DEFAULT_ACCENT.GLASS });
  });

  it("refuses unknown themes, bad colors and non-creators", async () => {
    const m = await load();
    expect((await m.saveOverlayAppearance({ theme: "NEON", accent: null })).status).toBe("INVALID");
    expect((await m.saveOverlayAppearance({ theme: "BOLD", accent: "red" })).status).toBe("INVALID");
    expect((await m.saveOverlayAppearance({ theme: "BOLD" })).status).toBe("INVALID");
    expect((await m.saveOverlayAppearance(null)).status).toBe("INVALID");
    expect(await m.getOverlayAppearance()).toEqual({ theme: "PILL", accent: null });
    signIn(["SUPPORTER"]);
    expect(await m.saveOverlayAppearance({ theme: "BOLD", accent: null })).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.getOverlayAppearance()).toBeNull();
  });

  it("picks a readable text color for any accent and names effects in Korean", () => {
    expect(readableInk("#FFD23F")).toBe("#111111");
    expect(readableInk("#FFFFFF")).toBe("#111111");
    expect(readableInk("#8B5CF6")).toBe("#FFFFFF");
    expect(readableInk("#111111")).toBe("#FFFFFF");
    expect(readableInk("nope")).toBe("#FFFFFF");
    expect(resolveTheme({ theme: "PILL", accent: null }, "BOLD")).toEqual({ theme: "BOLD", accent: THEME_DEFAULT_ACCENT.BOLD, accentInk: "#111111" });
    expect(effectLabel("Fade In")).toBe("스르륵 나타나기");
    expect(effectLabel("Slide In / Out")).toBe("밀려왔다 밀려나기");
    expect(effectLabel("없음")).toBe("효과 없음");
  });
});
