import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import type { AlertItem } from "./alertTypes";
import { WALL_SIZE } from "./widgetOverlayTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/**
 * 벽지 위젯 (2026-10-04 결정: 자동 배치 스티커 벽): every donation after the last 벽지 비우기 sticks a sticker
 * on a free spot of the 1920 × 1080 overlay; the 리모컨 shows how full the wall is and clears it.
 */
async function load() {
  const core = await import("./wallpaperCore");
  const remote = await import("./wallpaperRemote");
  const alerts = await import("./alertRemote");
  const overlay = await import("./widgetOverlay");
  const { widgetStore } = await import("./widgetStore");
  const { mockCreator } = await import("./mockCreatorStore");
  return { ...core, ...remote, ...alerts, ...overlay, widgetStore, overlayKey: mockCreator.integrationKey };
}

const START = Date.parse("2026-10-04T12:00:00Z");
const at = (sec: number) => new Date(START + sec * 1000).toISOString();
const item = (n: number, patch: Partial<AlertItem> = {}): AlertItem => ({
  id: `al-${n}`,
  kind: "DONATION",
  donor: `후원자${n}`,
  message: "",
  fnAmount: n * 1_000,
  typeLabel: "일반 후원",
  createdAt: at(n),
  status: "DONE",
  ...patch
});
const images = [
  { id: "a", url: "/a.png" },
  { id: "b", url: "/b.png" }
];

describe("벽지 스티커 배치", () => {
  beforeEach(() => resetMockStores());

  it("gives each donation since the wall was cleared its own spot on the screen", async () => {
    const m = await load();
    const feed = [item(-5), ...Array.from({ length: 10 }, (_, i) => item(i + 1))];
    const stickers = m.wallStickers(feed, { images }, at(0));
    expect(stickers.map((s) => s.id)).toEqual(feed.slice(1).map((a) => a.id)); // the one before 비우기 is not on the wall
    expect(stickers[0]).toMatchObject({ nickname: "후원자1", amount: "1,000 FN", image: 0, test: false });
    expect(stickers.map((s) => s.image)).toEqual([0, 1, 0, 1, 0, 1, 0, 1, 0, 1]);
    for (const s of stickers) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x + 200).toBeLessThanOrEqual(WALL_SIZE.w);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y + 300).toBeLessThanOrEqual(WALL_SIZE.h);
    }
    // Spots are cells of the screen: no two stickers share one.
    const cells = stickers.map((s) => `${Math.floor(s.x / 240)}:${Math.floor(s.y / 360)}`);
    expect(new Set(cells).size).toBe(stickers.length);
    // The same feed always gives the same wall (an OBS reload shows what was there).
    expect(m.wallStickers(feed, { images }, at(0))).toEqual(stickers);
  });

  it("keeps the latest stickers when the wall is full, and skips alerts that were never shown", async () => {
    const m = await load();
    const feed = Array.from({ length: m.WALL_SLOTS + 3 }, (_, i) => item(i + 1));
    feed.push(item(100, { status: "SKIPPED" }), item(101, { status: "FILTERED" }), item(102, { kind: "TEST", donor: "테스트 후원자" }));
    const stickers = m.wallStickers(feed, { images: [] }, at(0));
    expect(stickers).toHaveLength(m.WALL_SLOTS);
    expect(stickers[0].id).toBe("al-5"); // the oldest four gave their spots up
    expect(stickers.at(-1)).toMatchObject({ id: "al-102", test: true, image: null });
    expect(stickers.some((s) => s.id === "al-100" || s.id === "al-101")).toBe(false);
    const cells = stickers.map((s) => `${Math.floor(s.x / 240)}:${Math.floor(s.y / 360)}`);
    expect(new Set(cells).size).toBe(m.WALL_SLOTS);
  });
});

describe("벽지 오버레이 · 리모컨", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(START);
    resetMockStores();
  });
  afterEach(() => vi.useRealTimers());

  it("starts empty, sticks a 테스트 후원 on the wall and clears it from the 리모컨", async () => {
    const m = await load();
    expect(await m.getOverlayWidget("wallpaper", "wrong-key")).toBe("FORBIDDEN");
    const empty = await m.getOverlayWidget("wallpaper", m.overlayKey);
    if (empty === "FORBIDDEN" || empty.widget !== "wallpaper") throw new Error("wallpaper");
    expect(empty.stickers).toEqual([]); // the seeded donation history is older than the wall
    expect(empty.images).toEqual(m.widgetStore.WALLPAPER.images.map((i) => i.url));
    expect("images" in empty.settings).toBe(false); // sent once, not inside the settings
    expect(await m.getWallpaperRemote()).toMatchObject({ stickers: 0, slots: m.WALL_SLOTS });

    vi.setSystemTime(START + 1_000);
    expect(await m.sendTestAlert({ requestId: key(1), amount: 5_000, donor: "벽지테스터", message: "" })).toEqual({ status: "SAVED" });
    const one = await m.getOverlayWidget("wallpaper", m.overlayKey);
    if (one === "FORBIDDEN" || one.widget !== "wallpaper") throw new Error("wallpaper");
    expect(one.stickers).toHaveLength(1);
    expect(one.stickers[0]).toMatchObject({ nickname: "벽지테스터", amount: "5,000 FN", test: true, image: 0 });
    expect((await m.getWallpaperRemote())!.stickers).toBe(1);

    vi.setSystemTime(START + 2_000);
    expect(await m.clearWallpaper()).toEqual({ status: "SAVED" });
    const cleared = await m.getOverlayWidget("wallpaper", m.overlayKey);
    expect(cleared !== "FORBIDDEN" && cleared.widget === "wallpaper" && cleared.stickers).toEqual([]);
    expect(await m.getWallpaperRemote()).toMatchObject({ stickers: 0, clearedAt: new Date(START + 2_000).toISOString() });
  });

  it("follows the 리모컨 후원 위젯 switch and needs the creator to clear", async () => {
    const m = await load();
    await m.setOverlaySwitch({ target: "widgets", on: false });
    const off = await m.getOverlayWidget("wallpaper", m.overlayKey);
    expect(off !== "FORBIDDEN" && off.on).toBe(false);
    signIn(null);
    expect(await m.clearWallpaper()).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.getWallpaperRemote()).toBeNull();
  });
});
