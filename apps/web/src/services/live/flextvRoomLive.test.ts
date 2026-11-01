import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Phase 10: a FLEXTV stream's viewers and top donors for its room, against a stubbed FLEXTV API. */

vi.mock("@/lib/flextv/mode", () => ({ FLEXTV_BACKEND: true, FLEXTV_SITE: true, FLEXTV_WEB_URL: "https://www.flextv.test" }));

let calls: string[];
let ranking: () => Response;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("FLEXTV_API_URL", "https://api.flextv.test");
  delete (globalThis as Record<string, unknown>).__ssumnationFlextvRoomLive;
  calls = [];
  ranking = () => json({ data: [{ id: 901, loginId: "fan01", channelId: 3021, rank: 1, nickname: "열혈팬", amount: 5000, thumbUrl: "https://static.flextv.test/f.png" }], count: 1 });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = new URL(url);
      calls.push(`${u.pathname}${u.search}`);
      if (u.pathname === "/api/channels/3021/stream/player-count") return json({ data: 321 });
      if (u.pathname === "/v2/api/guest/RealTimeChannelRanking") return ranking();
      throw new Error(`unexpected FLEXTV call ${u.pathname}`);
    })
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("a FLEXTV room's running figures", () => {
  it("reads the viewers and this stream's top donors as a visitor, without member numbers or 아이디", async () => {
    const { getFlextvRoomLive } = await import("./flextvRoomLive");
    const live = await getFlextvRoomLive("3021");
    expect(live).toEqual({ viewers: 321, donors: [{ rank: 1, nickname: "열혈팬", amount: 5000, avatarUrl: "https://static.flextv.test/f.png" }] });
    expect(JSON.stringify(live)).not.toMatch(/fan01|901/);
    expect(calls).toEqual(["/api/channels/3021/stream/player-count", "/v2/api/guest/RealTimeChannelRanking?channelId=3021"]);
  });

  it("answers every open room of a channel from one read for a few seconds", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-30T12:00:00Z") });
    const { getFlextvRoomLive } = await import("./flextvRoomLive");
    await getFlextvRoomLive("3021");
    await getFlextvRoomLive("3021");
    expect(calls).toHaveLength(2);
    vi.setSystemTime(new Date("2026-10-30T12:00:06Z"));
    await getFlextvRoomLive("3021");
    expect(calls).toHaveLength(4);
  });

  it("keeps what FLEXTV did not say unknown, and asks nothing for what is not a channel id", async () => {
    ranking = () => new Response("Bad Gateway", { status: 502 });
    const { getFlextvRoomLive } = await import("./flextvRoomLive");
    expect(await getFlextvRoomLive("3021")).toEqual({ viewers: 321, donors: null });
    expect(await getFlextvRoomLive("1 OR 1=1")).toBeNull();
    expect(calls.filter((c) => c.includes("OR"))).toEqual([]);
  });
});
