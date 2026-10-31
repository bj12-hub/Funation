import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Live on the FLEXTV backend (phase 4): the live list behind getAllLiveChannels, a channel room's player, and the room's
 * chat actions — against a stubbed FLEXTV API.
 */

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7", "user-agent": "Mozilla/5.0 (Windows NT 10.0)" })
}));
vi.mock("@/lib/flextv/mode", () => ({ FLEXTV_BACKEND: true, FLEXTV_AUTH: true, FLEXTV_WALLET: true, FLEXTV_DONATION: true, FLEXTV_LIVE: true, FLEXTV_SSUMNATION_API: false, FLEXTV_WEB_URL: "https://www.flextv.test" }));
const member = { signedIn: true };
vi.mock("@/lib/session", () => ({
  getSession: async () => (member.signedIn ? { userId: "601924", nickname: "시청자", ssumnationId: "viewer01", avatarUrl: null, roles: ["SUPPORTER"] } : null),
  getFlextvAccessToken: async () => (member.signedIn ? "member-token" : null)
}));

type Call = { path: string; method: string; body: Record<string, unknown> | null; auth: string | null };
let calls: Call[];
let routes: Record<string, () => Response>;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("FLEXTV_API_URL", "https://api.flextv.test");
  calls = [];
  member.signedIn = true;
  const g = globalThis as Record<string, unknown>;
  delete g.__ssumnationFlextvLive;
  delete g.__ssumnationFlextvChat;
  delete g.__ssumnationFlextvRoomLive;
  delete g.__ssumnationFlextvThemes;
  routes = {
    "/api/channels/live-list-main": () =>
      json({
        data: [
          { channelId: 3021, title: "저녁 방송", thumbUrl: "https://thumb.flextv.test/a.jpg", playerCount: 50, startedAt: new Date(Date.now() - 3_600_000).toISOString(), isInLive: true, barrier: {}, owner: { nickname: "방송인" } },
          { channelId: 3022, title: "아침 방송", thumbUrl: null, playerCount: 500, startedAt: null, isInLive: true, barrier: {}, owner: { nickname: "다른 방송인" } }
        ],
        count: 2
      }),
    "/api/channels/3021/profile": () => json({ id: 3021, name: "방송국", isInLive: true, owner: { id: 601900, loginId: "bj01", nickname: "방송인", PI: "Y" } }),
    "/api/channels/3021/gift-types": () => json({ img: { host: [] } }),
    "/api/channels/3021/stream": () => json({ stream: { id: 77, title: "저녁 방송" }, status: { barrier: {}, performance: { viewerCount: 42 } } }),
    "/api/channels/3021/stream/recent/messages": () => json([{ member: { id: 9, loginId: "viewer09", nickname: "시청자9", level: 1 }, text: "안녕하세요", createdAt: "2026-10-25T10:00:01.000Z" }]),
    "/api/channels/3021/stream/message": () => new Response("OK", { status: 200 })
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const u = new URL(url);
      calls.push({ path: u.pathname, method: init.method ?? "GET", body: init.body ? JSON.parse(String(init.body)) : null, auth: new Headers(init.headers).get("authorization") });
      const route = routes[u.pathname];
      if (!route) throw new Error(`unexpected FLEXTV call ${u.pathname}`);
      return route();
    })
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("라이브 목록 (FLEXTV)", () => {
  it("lists FLEXTV's live streams by viewers, linked to each channel's room, read once per 15 s", async () => {
    const { getAllLiveChannels, getPopularLiveChannels } = await import("./liveChannels");
    const list = await getAllLiveChannels();
    expect(list.map((l) => [l.id, l.channelName, l.viewerCount, l.platform, l.href])).toEqual([
      ["3022", "다른 방송인", 500, "FLEXTV", "/creators/3022"],
      ["3021", "방송인", 50, "FLEXTV", "/creators/3021"]
    ]);
    expect(list[1].elapsedSeconds).toBeGreaterThanOrEqual(3_599);
    expect(list[0].thumbnailUrl).toMatch(/^\/mock\/live\//);
    await getPopularLiveChannels();
    expect(calls.filter((c) => c.path === "/api/channels/live-list-main")).toHaveLength(1);
    // The public list: asked without the member's token.
    expect(calls[0].auth).toBeNull();
  });

  it("gives each live FLEXTV's 방송 카테고리, and none when FLEXTV's categories cannot be read (phase 10)", async () => {
    const rows = (await routes["/api/channels/live-list-main"]().json()) as { data: Record<string, unknown>[] };
    routes["/api/channels/live-list-main"] = () => json({ data: [{ ...rows.data[0], themeId: 5 }, { ...rows.data[1], themeId: 99 }], count: 2 });
    routes["/api/guest/themes"] = () => json([{ key: 1, value: "5", text: "토크/캠방" }, { key: 2, value: "9", text: "게임" }]);
    const { getAllLiveChannels } = await import("./liveChannels");
    expect((await getAllLiveChannels()).map((l) => [l.id, l.category])).toEqual([
      ["3022", null],
      ["3021", { id: "5", name: "토크/캠방" }]
    ]);
  });
});

describe("채널 방 영상 (FLEXTV)", () => {
  it("plays a public stream in FLEXTV's embed player, with the stream for the chat", async () => {
    const { getFlextvCreatorRoom } = await import("@/services/creators/flextvChannel");
    const room = await getFlextvCreatorRoom("3021");
    expect(room?.stream).toMatchObject({ status: "LIVE", caption: "저녁 방송", viewerCount: 42, embed: { playerUrl: "https://www.flextv.test/embed/channels/3021/play", streamId: "77" } });
  });

  it("shows the stream's category, start and running figures under its player (phase 10)", async () => {
    routes["/api/channels/3021/stream"] = () =>
      json({ stream: { id: 77, title: "저녁 방송", themeId: 9, createdAt: "2026-10-30T09:00:00.000Z" }, status: { barrier: {}, performance: { viewerCount: 42 }, startedAt: "2026-10-30T09:00:03.000Z" } });
    routes["/api/guest/themes"] = () => json([{ key: 2, value: "9", text: "게임" }]);
    routes["/api/channels/3021/stream/player-count"] = () => json({ data: 57 });
    routes["/v2/api/guest/RealTimeChannelRanking"] = () => json({ data: [{ id: 5, loginId: "fan05", rank: 1, nickname: "열혈팬", amount: 3000, thumbUrl: null }], count: 1 });
    const { getFlextvCreatorRoom } = await import("@/services/creators/flextvChannel");
    const room = await getFlextvCreatorRoom("3021");
    expect(room?.stream).toMatchObject({
      status: "LIVE",
      viewerCount: 57,
      startedAt: "2026-10-30T09:00:03.000Z",
      category: "게임",
      live: { viewers: 57, donors: [{ rank: 1, nickname: "열혈팬", amount: 3000, avatarUrl: null }] }
    });
    expect(JSON.stringify(room)).not.toContain("fan05");
  });

  it("sends a 19+ stream to FLEXTV, and shows an ended one as offline", async () => {
    routes["/api/channels/3021/stream"] = () => json({ message: "로그인후 이용이 가능합니다." }, 400);
    const { getFlextvCreatorRoom } = await import("@/services/creators/flextvChannel");
    expect((await getFlextvCreatorRoom("3021"))?.stream).toMatchObject({ status: "LIVE", onFlextv: { url: "https://www.flextv.test/channels/3021/live", reason: "ADULT" } });
    routes["/api/channels/3021/stream"] = () => json({ message: "방송자가 방송을 종료 했습니다." }, 400);
    expect((await getFlextvCreatorRoom("3021"))?.stream.status).toBe("OFFLINE");
  });
});

describe("채널 방 채팅 (FLEXTV)", () => {
  it("passes on nickname, color and text only, and asks FLEXTV once for everyone reading at once", async () => {
    const { getRoomChat } = await import("./flextvRoomChat");
    const [a, b] = await Promise.all([getRoomChat("3021", "77"), getRoomChat("3021", "77")]);
    expect(a).toEqual(b);
    expect(a).toMatchObject({ status: "OK", lines: [{ nickname: "시청자9", text: "안녕하세요", color: expect.stringMatching(/^#[0-9a-f]{6}$/) }] });
    expect(JSON.stringify(a)).not.toMatch(/viewer09|"9"/);
    expect(calls.filter((c) => c.path.endsWith("/recent/messages"))).toHaveLength(1);
    expect(await getRoomChat("3021", "../x")).toEqual({ status: "INVALID" });
  });

  it("sends a line with the member's token, then reads afresh", async () => {
    const { getRoomChat, sendRoomChat } = await import("./flextvRoomChat");
    await getRoomChat("3021", "77");
    expect(await sendRoomChat({ channelId: "3021", streamId: "77", text: "  반가워요  " })).toEqual({ status: "SENT" });
    const sent = calls.find((c) => c.path.endsWith("/stream/message"))!;
    expect(sent.body).toEqual({ streamId: 77, source: "web", message: "반가워요", messageType: 0 });
    expect(sent.auth).toBe("Bearer member-token");
    await getRoomChat("3021", "77");
    expect(calls.filter((c) => c.path.endsWith("/recent/messages"))).toHaveLength(2);
  });

  it("refuses before FLEXTV: a guest, an empty or too long line; and words FLEXTV's refusals", async () => {
    const { sendRoomChat } = await import("./flextvRoomChat");
    expect(await sendRoomChat({ channelId: "3021", streamId: "77", text: "가".repeat(101) })).toEqual({ status: "REFUSED", message: "채팅은 100자까지 쓸 수 있어요." });
    expect(await sendRoomChat({ channelId: "3021", streamId: "77", text: "   " })).toMatchObject({ status: "REFUSED" });
    routes["/api/channels/3021/stream/message"] = () => json({ message: "잠시 동안 대화를 할 수 없습니다.", code: 403 }, 400);
    expect(await sendRoomChat({ channelId: "3021", streamId: "77", text: "안녕" })).toEqual({ status: "REFUSED", message: "지금은 채팅할 수 없어요. 잠시 후 다시 시도해 주세요." });
    member.signedIn = false;
    expect(await sendRoomChat({ channelId: "3021", streamId: "77", text: "안녕" })).toEqual({ status: "UNAUTHORIZED" });
    expect(calls.filter((c) => c.path.endsWith("/stream/message"))).toHaveLength(1);
  });
});
