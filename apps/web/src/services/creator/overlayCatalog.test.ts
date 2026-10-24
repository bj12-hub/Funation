import { describe, expect, it } from "vitest";
import { isVertical } from "@/services/creator/overlayThemeTypes";
import { OVERLAYS } from "./overlayCatalog";

/** 오버레이 주소: every overlay once, and the 세로 방송 versions of 후원 알림 · 통합 채팅 · 후원목표 (2026-10-08). */
describe("overlay catalog", () => {
  it("lists unique ids and titles", () => {
    expect(new Set(OVERLAYS.map((o) => o.id)).size).toBe(OVERLAYS.length);
    expect(new Set(OVERLAYS.map((o) => o.title)).size).toBe(OVERLAYS.length);
  });

  it("adds 세로 방송 versions on the same overlays with ?layout=vertical at a 1080-wide size", () => {
    const vertical = OVERLAYS.filter((o) => o.group === "세로 방송");
    expect(vertical.map((o) => o.id)).toEqual(["alert-vertical", "chat-vertical", "widget-goal-vertical"]);
    for (const o of vertical) {
      const url = new URL(o.path("key-1234"), "https://ssumnation.test");
      expect(isVertical(url.searchParams.get("layout")), o.id).toBe(true);
      expect(o.size.startsWith("1080 ×"), o.id).toBe(true);
      // The landscape overlay with the same path stays in the list.
      expect(OVERLAYS.some((x) => x.group !== "세로 방송" && x.path("key-1234") === url.pathname)).toBe(true);
    }
    expect(isVertical("horizontal")).toBe(false);
  });
});
