import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 영상 후원 · 그림후원 위젯: server-owned queue timing and gallery, overlays behind the key. */
async function load() {
  const media = await import("./media");
  const core = await import("./mediaCore");
  const { mockCreator } = await import("./mockCreatorStore");
  return { ...media, ...core, overlayKey: mockCreator.integrationKey };
}

const url = (id: string) => `https://youtu.be/${id}`;

describe("video queue", () => {
  beforeEach(() => {
    resetMockStores();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("auto-plays in order, ends each clip after its range (cut to 최대 재생) and dedupes test requests", async () => {
    const m = await load();
    await m.saveVideoSettings({ autoPlay: true, maxSec: 20, volume: 50 });
    expect(await m.addTestVideo({ requestId: key(1), url: url("aaaaaaaaaaa"), startSec: 10, endSec: 100 })).toEqual({ status: "OK" });
    await m.addTestVideo({ requestId: key(1), url: url("aaaaaaaaaaa"), startSec: 10, endSec: 100 });
    await m.addTestVideo({ requestId: key(2), url: url("bbbbbbbbbbb"), startSec: 0, endSec: 5 });

    let q = (await m.getVideoQueue())!;
    expect(q.playing?.videoId).toBe("aaaaaaaaaaa");
    expect(q.waiting.map((v) => v.videoId)).toEqual(["bbbbbbbbbbb"]);
    expect(await m.getOverlayVideo(m.overlayKey)).toMatchObject({ playing: { startSec: 10, endSec: 30 }, volume: 50 });

    vi.setSystemTime(new Date("2026-09-30T12:00:21Z"));
    q = (await m.getVideoQueue())!;
    expect(q.playing?.videoId).toBe("bbbbbbbbbbb");
    expect(q.history.map((v) => v.status)).toEqual(["DONE"]);

    await m.controlVideo({ id: q.playing!.id, action: "SKIP" });
    q = (await m.getVideoQueue())!;
    expect(q.playing).toBeNull();
    await m.controlVideo({ id: q.history[0].id, action: "REQUEUE" });
    expect((await m.getVideoQueue())!.playing?.videoId).toBe("bbbbbbbbbbb");
  });

  it("waits for 지금 재생 when 자동 재생 is off and rejects bad input", async () => {
    const m = await load();
    await m.saveVideoSettings({ autoPlay: false, maxSec: 60, volume: 70 });
    await m.addTestVideo({ requestId: key(3), url: url("ccccccccccc"), startSec: 0, endSec: 30 });
    const q = (await m.getVideoQueue())!;
    expect(q.playing).toBeNull();
    await m.controlVideo({ id: q.waiting[0].id, action: "PLAY" });
    expect((await m.getVideoQueue())!.playing?.videoId).toBe("ccccccccccc");

    expect((await m.addTestVideo({ requestId: key(4), url: "https://example.com/x", startSec: 0, endSec: 30 })).status).toBe("INVALID");
    expect((await m.addTestVideo({ requestId: key(5), url: url("ccccccccccc"), startSec: 30, endSec: 30 })).status).toBe("INVALID");
    expect((await m.saveVideoSettings({ autoPlay: true, maxSec: 5, volume: 70 })).status).toBe("INVALID");
    expect(await m.getOverlayVideo("wrong")).toBe("FORBIDDEN");
    signIn(["SUPPORTER"]);
    expect(await m.getVideoQueue()).toBeNull();
    expect(await m.controlVideo({ id: "x", action: "PLAY" })).toEqual({ status: "UNAUTHORIZED" });
  });

  it("queues a paid 영상 후원 on the studio channel only", async () => {
    const m = await load();
    m.enqueueDonationVideo("c1", { donor: "A", fnAmount: 1_000, videoId: "ddddddddddd", startSec: 0, endSec: 30 });
    expect((await m.getVideoQueue())!.playing).toBeNull();
    m.enqueueDonationVideo("studio", { donor: "A", fnAmount: 1_000, videoId: "ddddddddddd", startSec: 0, endSec: 30 });
    expect((await m.getVideoQueue())!.playing).toMatchObject({ kind: "DONATION", fnAmount: 1_000 });
  });
});

describe("drawing gallery", () => {
  beforeEach(() => {
    resetMockStores();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("shows a new drawing for the 전시 시간, can show it again, hide it and delete it", async () => {
    const m = await load();
    await m.saveDrawingSettings({ displaySec: 10 });
    await m.addTestDrawing({ requestId: key(1) });
    await m.addTestDrawing({ requestId: key(1) });
    const view = (await m.getDrawings())!;
    expect(view.drawings).toHaveLength(1);
    const id = view.drawings[0].id;
    expect(await m.getOverlayDrawing(m.overlayKey)).toMatchObject({ drawing: { id } });

    vi.setSystemTime(new Date("2026-09-30T12:00:11Z"));
    expect(await m.getOverlayDrawing(m.overlayKey)).toMatchObject({ drawing: null });
    await m.setDrawingShowing({ id });
    expect((await m.getDrawings())!.showing?.id).toBe(id);
    await m.setDrawingShowing({ id: null });
    expect((await m.getDrawings())!.showing).toBeNull();
    await m.deleteDrawing(id);
    expect((await m.getDrawings())!.drawings).toHaveLength(0);

    expect((await m.saveDrawingSettings({ displaySec: 1 })).status).toBe("INVALID");
    expect(await m.getOverlayDrawing("wrong")).toBe("FORBIDDEN");
    signIn(["SUPPORTER"]);
    expect(await m.addTestDrawing({ requestId: key(2) })).toEqual({ status: "UNAUTHORIZED" });
  });
});
