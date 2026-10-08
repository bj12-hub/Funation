import { describe, expect, it } from "vitest";
import { OVERLAY_TARGETS, offOverlayTargets, type OverlayTarget } from "./alertTypes";

const allOn = () => Object.fromEntries(OVERLAY_TARGETS.map((t) => [t.key, true])) as Record<OverlayTarget, boolean>;

/** 꺼진 오버레이: the remote summary takes every overlay, a studio manage page only its own. */
describe("offOverlayTargets", () => {
  it("lists nothing while every overlay is ON", () => {
    expect(offOverlayTargets(allOn())).toEqual([]);
    expect(offOverlayTargets(allOn(), ["banner"])).toEqual([]);
  });

  it("keeps 기능 제어 order and only the page's own overlays", () => {
    const switches = { ...allOn(), timer: false, banner: false, chat: false };
    expect(offOverlayTargets(switches).map((t) => t.key)).toEqual(["banner", "timer", "chat"]);
    expect(offOverlayTargets(switches, ["subtitle", "marquee", "timer", "credits"]).map((t) => t.label)).toEqual(["타이머"]); // 방송 도구
    expect(offOverlayTargets(switches, ["effects"])).toEqual([]);
  });
});
