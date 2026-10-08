import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 유튜브 연동 · 영상 목록: adapter-mapped core types, dedupe by platform id, failure keeps the last list. */
async function load() {
  const yt = await import("./youtube");
  const adapters = await import("@/services/platforms/adapters");
  const channel = await import("@/services/creators/channelVideos");
  return { ...yt, ...adapters, ...channel };
}

describe("youtube integration", () => {
  beforeEach(() => resetMockStores());

  it("connects once per request, maps videos to core types and never duplicates on re-sync", async () => {
    const m = await load();
    expect((await m.getYouTubeIntegration())!.status).toBe("DISCONNECTED");
    expect(await m.connectYouTube({ handle: "@MyChannel", requestId: key(1) })).toEqual({ status: "OK", added: 8 });
    expect(await m.connectYouTube({ handle: "@MyChannel", requestId: key(1) })).toEqual({ status: "OK" });
    const info = (await m.getYouTubeIntegration())!;
    expect(info).toMatchObject({ status: "CONNECTED", videoCount: 8, channel: { platform: "YOUTUBE", handle: "@mychannel" } });

    const videos = (await m.listManagedVideos())!;
    expect(videos[0]).toMatchObject({ platform: "YOUTUBE", visible: true, pinned: false });
    expect(Object.keys(videos[0]).sort()).toEqual(["durationSec", "externalId", "kind", "missing", "pinned", "platform", "publishedAt", "syncedAt", "title", "url", "viewCount", "visible"]);
    expect(videos.some((v) => v.kind === "SHORTS")).toBe(true);
    expect(videos.every((v) => v.viewCount >= 0 && v.durationSec > 0)).toBe(true);

    await m.updateVideo({ externalId: videos[0].externalId, visible: false });
    expect(await m.syncYouTubeVideos()).toEqual({ status: "OK", added: 0, missing: 0 });
    m.mockYouTubeUpload(info.channel!.externalChannelId);
    expect(await m.syncYouTubeVideos()).toEqual({ status: "OK", added: 1, missing: 0 });
    const after = (await m.listManagedVideos())!;
    expect(after).toHaveLength(9);
    expect(after.find((v) => v.externalId === videos[0].externalId)!.visible).toBe(false);
  });

  it("pins up to 3 visible videos and validates input", async () => {
    const m = await load();
    await m.connectYouTube({ handle: "pins", requestId: key(2) });
    const v = (await m.listManagedVideos())!;
    for (const x of v.slice(0, 3)) expect(await m.updateVideo({ externalId: x.externalId, pinned: true })).toEqual({ status: "OK" });
    expect((await m.updateVideo({ externalId: v[3].externalId, pinned: true })).status).toBe("INVALID");
    expect((await m.listManagedVideos())!.slice(0, 3).every((x) => x.pinned)).toBe(true);
    await m.updateVideo({ externalId: v[0].externalId, visible: false });
    expect((await m.listManagedVideos())!.find((x) => x.externalId === v[0].externalId)!.pinned).toBe(false);
    expect((await m.updateVideo({ externalId: "nope", visible: true })).status).toBe("INVALID");
    expect((await m.connectYouTube({ handle: "x", requestId: key(3) })).status).toBe("INVALID");
    expect((await m.connectYouTube({ handle: "other", requestId: key(4) })).status).toBe("INVALID");
  });

  it("reports platform failures and keeps the last good list", async () => {
    const m = await load();
    expect(await m.connectYouTube({ handle: "timeout-channel", requestId: key(5) })).toEqual({ status: "PLATFORM_ERROR", code: "TIMEOUT" });
    expect(await m.connectYouTube({ handle: "missing-one", requestId: key(6) })).toEqual({ status: "PLATFORM_ERROR", code: "NOT_FOUND" });
    expect((await m.getYouTubeIntegration())!.status).toBe("DISCONNECTED");

    await m.connectYouTube({ handle: "okchannel", requestId: key(7) });
    const channel = (await m.getYouTubeIntegration())!.channel!;
    vi.spyOn(m.YouTubeAdapter, "listVideos").mockRejectedValueOnce(new (await import("@/services/platforms/platformTypes")).PlatformError("UNAVAILABLE", "down"));
    expect(await m.syncYouTubeVideos()).toEqual({ status: "PLATFORM_ERROR", code: "UNAVAILABLE" });
    expect(await m.getYouTubeIntegration()).toMatchObject({ status: "ERROR", lastError: "UNAVAILABLE", videoCount: 8, channel });
    await m.syncYouTubeVideos();
    expect((await m.getYouTubeIntegration())!.status).toBe("CONNECTED");
    await m.disconnectYouTube();
    expect(await m.getYouTubeIntegration()).toMatchObject({ status: "DISCONNECTED", videoCount: 0 });
  });

  it("never treats Object.prototype names as a video or a request id", async () => {
    const m = await load();
    await m.connectYouTube({ handle: "protochannel", requestId: key(8) });
    try {
      expect((await m.updateVideo({ externalId: "__proto__", visible: false, pinned: true })).status).toBe("INVALID");
      expect("visible" in {}).toBe(false);
      expect("pinned" in {}).toBe(false);
    } finally {
      delete (Object.prototype as Record<string, unknown>).visible;
      delete (Object.prototype as Record<string, unknown>).pinned;
    }
    await m.disconnectYouTube();
    // "propertyIsEnumerable" passes the request-id pattern; it is a new request, not an earlier one.
    expect(await m.connectYouTube({ handle: "protochannel", requestId: "propertyIsEnumerable" })).toEqual({ status: "OK", added: 8 });
  });

  it("marks videos YouTube no longer shows as missing, keeps their settings and unmarks one that comes back", async () => {
    const m = await load();
    await m.connectYouTube({ handle: "gonechannel", requestId: key(9) });
    const channelId = (await m.getYouTubeIntegration())!.channel!.externalChannelId;
    const [a, b] = (await m.listManagedVideos())!;
    await m.updateVideo({ externalId: a.externalId, pinned: true });
    await m.updateVideo({ externalId: b.externalId, visible: false });
    m.mockYouTubeRemove(channelId, a.externalId);
    m.mockYouTubeRemove(channelId, b.externalId);
    expect(await m.syncYouTubeVideos()).toEqual({ status: "OK", added: 0, missing: 2 });
    const find = async (id: string) => (await m.listManagedVideos())!.find((v) => v.externalId === id);
    expect((await m.listManagedVideos())!).toHaveLength(8);
    expect(await find(a.externalId)).toMatchObject({ missing: true, pinned: true, visible: true });
    expect(await find(b.externalId)).toMatchObject({ missing: true, pinned: false, visible: false });
    expect((await m.updateVideo({ externalId: b.externalId, visible: true })).status).toBe("OK");
    expect(await m.updateVideo({ externalId: b.externalId, pinned: true })).toEqual({ status: "INVALID", message: "유튜브에서 찾을 수 없는 영상은 고정할 수 없어요." });

    m.mockYouTubeRemove(channelId, a.externalId, false);
    expect(await m.syncYouTubeVideos()).toEqual({ status: "OK", added: 0, missing: 1 });
    expect(await find(a.externalId)).toMatchObject({ missing: false, pinned: true, visible: true });
    expect(await find(b.externalId)).toMatchObject({ missing: true, visible: true });
  });

  it("checks stored videos past the latest page by id, so an older video is not taken for a deleted one", async () => {
    const m = await load();
    await m.connectYouTube({ handle: "bigchannel", requestId: key(10) });
    const channelId = (await m.getYouTubeIntegration())!.channel!.externalChannelId;
    for (let i = 0; i < 45; i++) m.mockYouTubeUpload(channelId);
    expect(await m.syncYouTubeVideos()).toEqual({ status: "OK", added: 45, missing: 0 });
    const oldest = (await m.listManagedVideos())!.at(-1)!;
    expect((await m.listManagedVideos())!.every((v) => !v.missing)).toBe(true);
    m.mockYouTubeRemove(channelId, oldest.externalId);
    expect(await m.syncYouTubeVideos()).toEqual({ status: "OK", added: 0, missing: 1 });
    expect((await m.listManagedVideos())!.filter((v) => v.missing).map((v) => v.externalId)).toEqual([oldest.externalId]);
  });

  it("drops a sync whose channel was disconnected and replaced during the platform call", async () => {
    const m = await load();
    await m.connectYouTube({ handle: "firstchannel", requestId: key(11) });
    const real = m.YouTubeAdapter.listVideos.bind(m.YouTubeAdapter);
    vi.spyOn(m.YouTubeAdapter, "listVideos").mockImplementationOnce(async (id, opts) => {
      const videos = await real(id, opts);
      await m.disconnectYouTube();
      await m.connectYouTube({ handle: "secondchannel", requestId: key(12) });
      return videos;
    });
    expect((await m.syncYouTubeVideos()).status).toBe("INVALID");
    const info = (await m.getYouTubeIntegration())!;
    expect(info).toMatchObject({ status: "CONNECTED", videoCount: 8, channel: { handle: "@secondchannel" } });
    const prefix = info.channel!.externalChannelId.slice(2, 8);
    expect((await m.listManagedVideos())!.every((v) => v.externalId.startsWith(prefix))).toBe(true);
  });

  it("declares capabilities per platform and lists public channel videos only where supported", async () => {
    const m = await load();
    expect(m.ADAPTERS.YOUTUBE.capabilities).toContain("VIDEO_LIST");
    expect(m.ADAPTERS.SOOP.capabilities).not.toContain("VIDEO_LIST");
    await expect(m.ADAPTERS.FLEXTV.listVideos("x")).rejects.toMatchObject({ code: "UNSUPPORTED" });
    expect(m.parseIsoDuration("PT1H2M3S")).toBe(3723);
    const pub = (await m.getPublicChannelVideos("c1"))!;
    expect(pub.videos.length).toBeGreaterThan(0);
    expect(pub).toMatchObject({ unsupported: false, error: null });
    expect(await m.getPublicChannelVideos("nope")).toBeNull();
    signIn(["SUPPORTER"]);
    expect(await m.getYouTubeIntegration()).toBeNull();
    expect(await m.syncYouTubeVideos()).toEqual({ status: "UNAUTHORIZED" });
  });
});
