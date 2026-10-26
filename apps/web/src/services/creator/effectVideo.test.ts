import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/**
 * 후원 이펙트 영상 (2026-10-25, StreamDonate 후원 이펙트 "금액 계단별 영상"): 영상 in the library, served in byte ranges, and
 * played by the 레이어 효과 구간 the alert reaches.
 */
async function load() {
  const assets = await import("./assets");
  const assetTypes = await import("./assetTypes");
  const fx = await import("./effects");
  const remote = await import("./alertRemote");
  const route = await import("@/app/api/media/[id]/route");
  const { mockCreator } = await import("./mockCreatorStore");
  return { ...assets, ...assetTypes, ...fx, ...remote, GET: route.GET, overlayKey: mockCreator.integrationKey };
}

/** The first bytes of an MP4 (an ftyp box) and of a WebM (the EBML header), padded. */
const MP4 = [0, 0, 0, 0x18, ...[..."ftypisom"].map((c) => c.charCodeAt(0)), 0, 0, 2, 0, 0x69, 0x73, 0x6f, 0x6d, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const WEBM = [0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 1, 2, 3];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const form = (n: number, bytes: number[], type: string, name: string) => {
  const fd = new FormData();
  fd.set("requestId", key(n));
  fd.set("file", new File([new Uint8Array(bytes)], name, { type }));
  return fd;
};

const tiers = (videoUrl?: string | null) => ({
  emoji: { enabled: false, minFn: 1_000, emojis: ["🎉"], count: 16 },
  layer: { enabled: true, tiers: [{ minFn: 10_000, effect: "HEARTS", ...(videoUrl === undefined ? {} : { videoUrl }) }, { minFn: 100_000, effect: "FIREWORKS", videoUrl: null }] }
});

describe("영상 in the library", () => {
  beforeEach(() => resetMockStores());

  it("takes MP4 and WebM by their content, alone (no 짝), up to the size limit", async () => {
    const m = await load();
    const mp4 = await m.uploadAsset(form(1, MP4, "video/mp4", "축하.mp4"));
    expect(mp4).toMatchObject({ status: "SAVED", asset: { kind: "VIDEO", mime: "video/mp4", name: "축하" } });
    expect(await m.uploadAsset(form(2, WEBM, "video/webm", "박수.webm"))).toMatchObject({ status: "SAVED", asset: { kind: "VIDEO", mime: "video/webm" } });
    // A sound with the same name does not pair with a video.
    await m.uploadAsset(form(3, [0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 0], "audio/mpeg", "축하.mp3"));
    const library = (await m.listAssets())!;
    expect(m.pairOf(library.find((a) => a.kind === "VIDEO" && a.name === "축하")!, library)).toBeNull();
    expect((await m.listAssets("VIDEO"))!.map((a) => a.name)).toEqual(["박수", "축하"]);

    expect(await m.uploadAsset(form(4, PNG, "video/mp4", "가짜.mp4"))).toEqual({ status: "INVALID", message: "파일 내용이 형식과 맞지 않아요." });
    expect(await m.uploadAsset(form(5, MP4, "video/quicktime", "x.mov"))).toMatchObject({ status: "INVALID", message: expect.stringContaining("MP4 · WEBM 영상") });
    const big = new FormData();
    big.set("requestId", key(6));
    big.set("file", new File([new Uint8Array(m.ASSET_LIMITS.bytes.VIDEO + 1)], "큰.mp4", { type: "video/mp4" }));
    expect(await m.uploadAsset(big)).toEqual({ status: "INVALID", message: "영상은 15MB 이하만 올릴 수 있어요." });
  });

  it("serves byte ranges, so a player can stream and seek", async () => {
    const m = await load();
    const up = await m.uploadAsset(form(1, MP4, "video/mp4", "축하.mp4"));
    if (up.status !== "SAVED") throw new Error("upload");
    const get = (range?: string) =>
      m.GET(new Request(`http://localhost${up.asset.url}`, { headers: range ? { range } : {} }), { params: Promise.resolve({ id: up.asset.id }) });
    const whole = await get();
    expect(whole.status).toBe(200);
    expect(whole.headers.get("Accept-Ranges")).toBe("bytes");
    expect([...new Uint8Array(await whole.arrayBuffer())]).toEqual(MP4);

    const part = await get("bytes=4-11");
    expect(part.status).toBe(206);
    expect(part.headers.get("Content-Range")).toBe(`bytes 4-11/${MP4.length}`);
    expect(new TextDecoder().decode(await part.arrayBuffer())).toBe("ftypisom");
    const open = await get("bytes=20-");
    expect([open.status, open.headers.get("Content-Range")]).toEqual([206, `bytes 20-${MP4.length - 1}/${MP4.length}`]);
    const tail = await get("bytes=-3");
    expect([...new Uint8Array(await tail.arrayBuffer())]).toEqual(MP4.slice(-3));
    expect((await get(`bytes=${MP4.length}-`)).status).toBe(416);
    expect((await get("bytes=oops")).status).toBe(200); // anything else: the whole file
  });
});

describe("후원 이펙트 영상", () => {
  beforeEach(() => resetMockStores());

  it("plays the 영상 of the largest 구간 the alert reaches, while it is in the library", async () => {
    const m = await load();
    const up = await m.uploadAsset(form(1, MP4, "video/mp4", "축하.mp4"));
    if (up.status !== "SAVED") throw new Error("upload");
    expect(await m.saveEffectSettings(tiers(up.asset.url))).toEqual({ status: "SAVED" });
    expect((await m.getEffectSettings())!.layer.tiers.map((t) => t.videoUrl)).toEqual([up.asset.url, null]);

    await m.sendTestAlert({ requestId: key(10), amount: 50_000, donor: "A" });
    expect(await m.getOverlayEffects(m.overlayKey)).toMatchObject({ layer: "HEARTS", video: up.asset.url });

    // Deleted from the library: the 구간 plays its effect only.
    expect(await m.deleteAsset(up.asset.id)).toEqual({ status: "DELETED" });
    expect(await m.getOverlayEffects(m.overlayKey)).toMatchObject({ layer: "HEARTS", video: null });
  });

  it("accepts tiers without a 영상 (and saved before), and refuses one that is not a library 영상", async () => {
    const m = await load();
    expect(await m.saveEffectSettings(tiers())).toEqual({ status: "SAVED" });
    expect((await m.getEffectSettings())!.layer.tiers[0].videoUrl).toBeNull();
    const img = await m.uploadAsset(form(1, PNG, "image/png", "그림.png"));
    if (img.status !== "SAVED") throw new Error("upload");
    for (const bad of [img.asset.url, "/api/media/00000000-0000-4000-8000-000000000000", "https://example.invalid/a.mp4", 3]) {
      expect(await m.saveEffectSettings(tiers(bad as string))).toEqual({ status: "INVALID", message: "구간 영상을 라이브러리에서 다시 골라 주세요." });
    }
    await m.sendTestAlert({ requestId: key(11), amount: 500, donor: "B" });
    expect(await m.getOverlayEffects(m.overlayKey)).toMatchObject({ layer: null, video: null });
  });
});
