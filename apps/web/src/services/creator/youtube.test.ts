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
    expect(Object.keys(videos[0]).sort()).toEqual(["durationSec", "externalId", "kind", "pinned", "platform", "publishedAt", "syncedAt", "title", "url", "viewCount", "visible"]);
    expect(videos.some((v) => v.kind === "SHORTS")).toBe(true);
    expect(videos.every((v) => v.viewCount >= 0 && v.durationSec > 0)).toBe(true);

    await m.updateVideo({ externalId: videos[0].externalId, visible: false });
    expect(await m.syncYouTubeVideos()).toEqual({ status: "OK", added: 0 });
    m.mockYouTubeUpload(info.channel!.externalChannelId);
    expect(await m.syncYouTubeVideos()).toEqual({ status: "OK", added: 1 });
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
