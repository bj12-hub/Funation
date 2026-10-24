import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import { canvasByQuery, catalogSize, placeNew, type LayoutItem } from "./overlayLayoutTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 원소스 오버레이 배치 (2026-10-24, StreamDonate "오버레이 설정 (원소스)" 참고) — P3. */
async function load() {
  const layout = await import("./overlayLayout");
  const { mockCreator } = await import("./mockCreatorStore");
  return { ...layout, overlayKey: mockCreator.integrationKey };
}

const item = (patch: Partial<LayoutItem> = {}): LayoutItem => ({ id: "it-0001", overlayId: "alert", x: 560, y: 240, width: 800, height: 600, scale: 1, hidden: false, ...patch });

describe("원소스 배치 도우미", () => {
  it("reads the canvas from ?canvas= and places a new overlay centred, scaled down only when it does not fit", () => {
    expect(canvasByQuery("portrait").key).toBe("PORTRAIT");
    expect(canvasByQuery("nope").key).toBe("PC");
    expect(catalogSize("420 × 400 (가로형 1200 × 260)")).toEqual([420, 400]);
    expect(placeNew("it-1", "alert", [800, 600], "PC")).toEqual(item({ id: "it-1" }));
    // 1920 × 1080 on the 1080-wide 세로 canvas: 56% wide, centred.
    expect(placeNew("it-2", "effects", [1920, 1080], "PORTRAIT")).toEqual({ id: "it-2", overlayId: "effects", x: 2, y: 658, width: 1920, height: 1080, scale: 0.56, hidden: false });
  });
});

describe("원소스 오버레이 배치", () => {
  beforeEach(() => resetMockStores());

  it("saves a canvas layout in layer order, checking every value", async () => {
    const m = await load();
    const view = (await m.getOverlayLayoutView())!;
    expect(view.overlayKey).toBe(m.overlayKey);
    expect(view.canvases.PC).toEqual({ items: [], revision: 0, updatedAt: null });
    const items = [item(), item({ id: "it-0002", overlayId: "chat", x: -100, y: 1000, width: 400, height: 600, scale: 0.755, hidden: true })];
    expect(await m.saveOverlayLayout({ canvas: "PC", items, revision: 0, requestId: key(1) })).toEqual({ status: "SAVED", revision: 1 });
    const saved = (await m.getOverlayLayoutView())!.canvases;
    expect(saved.PC.items).toEqual([items[0], { ...items[1], scale: 0.76 }]);
    expect(saved.PC.revision).toBe(1);
    expect(saved.PORTRAIT.items).toEqual([]); // canvases are separate

    for (const [items, message] of [
      ["x", "배치 값을 확인해 주세요."],
      [Array.from({ length: 21 }, (_, i) => item({ id: `it-${1000 + i}` })), "한 캔버스에 오버레이는 20개까지 놓을 수 있어요."],
      [[item(), item()], "배치 값을 확인해 주세요."],
      [[item({ id: "x" })], "배치 값을 확인해 주세요."],
      [[item({ overlayId: "nope" })], "없는 오버레이가 있어요. 화면을 새로 고쳐 주세요."],
      [[item({ x: 3841 })], "위치는 -3840 ~ 3840px 안의 정수로 넣어 주세요."],
      [[item({ y: 1.5 })], "위치는 -3840 ~ 3840px 안의 정수로 넣어 주세요."],
      [[item({ width: 39 })], "가로 · 세로는 40 ~ 3840px 정수로 넣어 주세요."],
      [[item({ scale: 4.01 })], "스케일은 10 ~ 400%예요."],
      [[item({ scale: Number.NaN })], "스케일은 10 ~ 400%예요."],
      [[{ ...item(), hidden: "no" }], "배치 값을 확인해 주세요."]
    ] as const) {
      expect(await m.saveOverlayLayout({ canvas: "LANDSCAPE", items, revision: 0, requestId: key(2) })).toEqual({ status: "INVALID", message });
    }
    expect(await m.saveOverlayLayout({ canvas: "TV", items: [], revision: 0, requestId: key(2) })).toEqual({ status: "INVALID", message: "잘못된 요청입니다." });
    signIn(["SUPPORTER"]);
    expect(await m.saveOverlayLayout({ canvas: "PC", items: [], revision: 1, requestId: key(3) })).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.getOverlayLayoutView()).toBeNull();
  });

  it("refuses to save over a newer layout, and counts a retried save once", async () => {
    const m = await load();
    expect(await m.saveOverlayLayout({ canvas: "PC", items: [item()], revision: 0, requestId: key(1) })).toEqual({ status: "SAVED", revision: 1 });
    expect(await m.saveOverlayLayout({ canvas: "PC", items: [item()], revision: 0, requestId: key(1) })).toEqual({ status: "SAVED", revision: 1 }); // retried
    // Another tab still at revision 0.
    expect(await m.saveOverlayLayout({ canvas: "PC", items: [], revision: 0, requestId: key(2) })).toEqual({
      status: "CONFLICT",
      message: "다른 곳에서 이 캔버스를 먼저 저장했어요. 최신 배치를 불러온 뒤 다시 저장해 주세요."
    });
    expect((await m.getOverlayLayoutView())!.canvases.PC.items).toEqual([item()]);
    expect(await m.saveOverlayLayout({ canvas: "PC", items: [], revision: 1, requestId: key(3) })).toEqual({ status: "SAVED", revision: 2 });
  });

  it("shows the canvas on OBS by the integration key: shown overlays bottom first, with their own addresses", async () => {
    const m = await load();
    expect(await m.getOneSource("nope", "pc")).toBe("FORBIDDEN");
    const items = [item({ id: "it-bott", overlayId: "widget-wallpaper", width: 1920, height: 1080, x: 0, y: 0 }), item({ id: "it-hide", hidden: true }), item({ id: "it-top1", overlayId: "play-rumble", width: 480, height: 720 })];
    await m.saveOverlayLayout({ canvas: "PORTRAIT", items, revision: 0, requestId: key(1) });
    const k = m.overlayKey;
    expect(await m.getOneSource(k, "portrait")).toEqual({
      canvas: "PORTRAIT",
      width: 1080,
      height: 1920,
      revision: 1,
      items: [
        { ...items[0], src: `/overlay/widget/wallpaper/${k}`, title: "벽지" },
        { ...items[2], src: `/overlay/play/${k}?rumble`, title: "로얄 럼블" }
      ]
    });
    expect(await m.getOneSource(k, undefined)).toMatchObject({ canvas: "PC", width: 1920, height: 1080, items: [] });
  });
});
