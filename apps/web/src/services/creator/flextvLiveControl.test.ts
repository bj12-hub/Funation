import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Phase 10: 방송 설정's 지금 방송 panel on FLEXTV, against a stubbed FLEXTV API. */

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7", "user-agent": "Mozilla/5.0" })
}));
vi.mock("@/lib/flextv/mode", () => ({ FLEXTV_BACKEND: true, FLEXTV_AUTH: true, FLEXTV_STUDIO: true, FLEXTV_SITE: true, FLEXTV_WEB_URL: "https://www.flextv.test" }));
const member = { creator: true };
vi.mock("@/lib/session", () => ({
  getCreatorSession: async () => (member.creator ? { userId: "601900", nickname: "방송인", ssumnationId: "bj01", avatarUrl: null, roles: ["SUPPORTER", "CREATOR"] } : null),
  getFlextvAccessToken: async () => "member-token"
}));

let state: { live: boolean; frozen: boolean; muted: number[]; blacklist: string[]; calls: { method: string; path: string; body: Record<string, unknown> }[] };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const text = (body: string, status = 200) => new Response(body, { status });
const players = () => [
  { id: 601900, loginId: "bj01", nickname: "방송인", role: { channel: "O", app: "B" }, ranking: -1, level: 0, isDumb: false },
  { id: 601950, loginId: "helper01", nickname: "매니저", role: { channel: "M", app: "B" }, ranking: -1, level: 0, isDumb: false },
  { id: 601924, loginId: "viewer01", nickname: "열혈팬", role: { channel: "V", app: "B" }, ranking: 2, level: 3, isDumb: state.muted.includes(601924) },
  { id: 601925, loginId: "viewer02", nickname: "시청자", role: { channel: "V", app: "B" }, ranking: -1, level: 0, isDumb: false }
];

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("FLEXTV_API_URL", "https://api.flextv.test");
  delete (globalThis as Record<string, unknown>).__ssumnationFlextvRoomLive;
  member.creator = true;
  state = { live: true, frozen: false, muted: [], blacklist: [], calls: [] };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const u = new URL(url);
      const method = init.method ?? "GET";
      const body = typeof init.body === "string" ? JSON.parse(init.body) : {};
      const p = u.pathname;
      if (method !== "GET") state.calls.push({ method, path: p, body });
      if (p === "/api/my/channel/profile") return json({ id: 3021, name: "방송인의 방송국", isInLive: state.live ? 1 : 0, stream: state.live ? { id: 77, title: "저녁 방송" } : null });
      if (p === "/api/channels/3021/stream") return json({ stream: { id: 77, title: "저녁 방송", isFrozen: state.frozen, createdAt: "2026-10-30T09:00:00.000Z" }, status: { startedAt: "2026-10-30T09:00:02.000Z" } });
      if (p === "/api/channels/3021/stream/players") return json(players());
      if (p === "/api/channels/3021/stream/player-count") return json({ data: 4 });
      if (p === "/api/channels/3021/stream/player-count-accumulate") return json({ data: 31 });
      if (p === "/v2/api/guest/RealTimeChannelRanking") return json({ data: [{ id: 601924, loginId: "viewer01", rank: 1, nickname: "열혈팬", amount: 3000, thumbUrl: null }], count: 1 });
      if (p === "/api/channels/3021/stream/freeze") return (state.frozen = !state.frozen), text("OK");
      if (p === "/api/channels/3021/stream/dumb") return body.memberId === 601950 ? text("Bad Request", 400) : ((state.muted = body.isDumb ? [...state.muted, body.memberId] : state.muted.filter((id) => id !== body.memberId)), text("OK"));
      if (p === "/api/channels/3021/stream/kick") return text("OK");
      if (p === "/api/channels/3021/blacklist") return state.blacklist.push(body.loginId), text("OK");
      throw new Error(`unexpected FLEXTV call ${method} ${p}`);
    })
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const load = () => import("./flextvLiveControl");

describe("지금 방송", () => {
  it("shows the stream's figures, top donors and who is in the room — by 아이디, never by member number", async () => {
    const { getFlextvLiveControl } = await load();
    const view = await getFlextvLiveControl();
    expect(view).toMatchObject({
      channelId: "3021",
      playerUrl: "https://www.flextv.test/embed/channels/3021/play",
      startedAt: "2026-10-30T09:00:02.000Z",
      viewers: 4,
      totalViewers: 31,
      frozen: false,
      donors: [{ rank: 1, nickname: "열혈팬", amount: 3000 }]
    });
    expect(view?.people?.map((v) => [v.loginId, v.role])).toEqual([
      ["bj01", "OWNER"],
      ["helper01", "MANAGER"],
      ["viewer01", "HOT_FAN"],
      ["viewer02", "VIEWER"]
    ]);
    expect(JSON.stringify(view)).not.toMatch(/6019\d\d/);
  });

  it("is not there off air, or for someone who is not a streamer", async () => {
    const { getFlextvLiveControl } = await load();
    state.live = false;
    expect(await getFlextvLiveControl()).toBeNull();
    member.creator = false;
    state.live = true;
    expect(await getFlextvLiveControl()).toBeNull();
  });

  it("mutes, kicks and blacklists a viewer by 아이디, looked up in the room now", async () => {
    const { flextvLiveControl } = await load();
    expect(await flextvLiveControl({ action: "MUTE", loginId: "viewer01" })).toEqual({ status: "DONE" });
    expect(state.calls.at(-1)).toEqual({ method: "POST", path: "/api/channels/3021/stream/dumb", body: { memberId: 601924, isDumb: true } });
    expect(await flextvLiveControl({ action: "KICK", loginId: "viewer02" })).toEqual({ status: "DONE" });
    expect(state.calls.at(-1)).toEqual({ method: "POST", path: "/api/channels/3021/stream/kick", body: { memberId: 601925 } });
    expect(await flextvLiveControl({ action: "BLACKLIST", loginId: "viewer02" })).toEqual({ status: "DONE" });
    expect(state.blacklist).toEqual(["viewer02"]);
    expect(state.calls.slice(-2).map((c) => c.path)).toEqual(["/api/channels/3021/blacklist", "/api/channels/3021/stream/kick"]);
  });

  it("turns 채팅 얼리기 over", async () => {
    const { flextvLiveControl, getFlextvLiveControl } = await load();
    expect(await flextvLiveControl({ action: "FREEZE" })).toEqual({ status: "DONE" });
    expect((await getFlextvLiveControl())?.frozen).toBe(true);
  });

  it("refuses what FLEXTV would, and what is not in the room", async () => {
    const { flextvLiveControl } = await load();
    expect(await flextvLiveControl({ action: "KICK", loginId: "bj01" })).toEqual({ status: "INVALID", message: "나 자신에게는 할 수 없어요." });
    expect(await flextvLiveControl({ action: "MUTE", loginId: "helper01" })).toMatchObject({ status: "INVALID" });
    expect(await flextvLiveControl({ action: "KICK", loginId: "nobody" })).toMatchObject({ status: "INVALID" });
    expect(await flextvLiveControl({ action: "KICK", loginId: "a b" })).toEqual({ status: "INVALID", message: "잘못된 요청입니다." });
    expect(await flextvLiveControl({ action: "DELETE", loginId: "viewer01" })).toEqual({ status: "INVALID", message: "잘못된 요청입니다." });
    expect(state.calls.filter((c) => c.path.endsWith("/kick"))).toEqual([]);
    state.live = false;
    expect(await flextvLiveControl({ action: "FREEZE" })).toEqual({ status: "INVALID", message: "방송 중일 때만 할 수 있어요." });
    member.creator = false;
    expect(await flextvLiveControl({ action: "FREEZE" })).toEqual({ status: "UNAUTHORIZED" });
  });
});
