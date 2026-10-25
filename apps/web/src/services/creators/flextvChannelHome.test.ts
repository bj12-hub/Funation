import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Phase 9: a FLEXTV channel room's 팬 랭킹 and 소식, against a stubbed FLEXTV API. */

vi.mock("@/lib/flextv/mode", () => ({ FLEXTV_BACKEND: true, FLEXTV_AUTH: true, FLEXTV_SITE: true, FLEXTV_WEB_URL: "https://www.flextv.test" }));
let token: string | null;
vi.mock("@/lib/session", () => ({ getFlextvAccessToken: async () => token }));

let calls: { path: string; auth: string | null }[];
let down: boolean;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const post = (id: number, important = 0) => ({ id, title: `소식 ${id}`, content: "본문", imageUrl: null, important, createdAt: "2026-10-24T11:00:00.000Z", viewCount: 3, adult: 0, parent: 0 });

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("FLEXTV_API_URL", "https://api.flextv.test");
  token = null;
  calls = [];
  down = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const u = new URL(url);
      calls.push({ path: `${u.pathname}${u.search}`, auth: new Headers(init.headers).get("authorization") });
      if (down) return json(null, 502);
      if (u.pathname === "/api/channels/3021/fans") {
        return json({ data: [{ level: 5, name: "VIP", member: { id: 7, nickname: "열혈팬", loginId: "fan01" } }, { level: 1, name: "팬", member: { id: 8, nickname: "시청자", loginId: "viewer01" } }], count: 2 });
      }
      if (u.pathname === "/api/channels/3021/channel-notices") {
        const limit = Number(u.searchParams.get("limit"));
        return json({ data: [post(1, 1), post(2), post(3), post(4)].slice(0, limit) });
      }
      throw new Error(`unexpected FLEXTV call ${u.pathname}`);
    })
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the 팬 랭킹", () => {
  it("ranks this month's fans by FLEXTV's order, shows their 팬 등급 and marks the viewer — never an amount", async () => {
    const { getFlextvChannelRanking } = await import("./flextvChannelHome");
    const ranking = await getFlextvChannelRanking("3021", "viewer01");
    expect(ranking.source).toBe("FLEXTV");
    expect(ranking.month).toMatch(/^\d{4}-\d{2}$/);
    expect(ranking.rows).toEqual([
      { rank: 1, name: "열혈팬", fnAmount: null, level: "VIP", me: false },
      { rank: 2, name: "시청자", fnAmount: null, level: "팬", me: true }
    ]);
    // Asked as a visitor, for this month.
    expect(calls).toEqual([{ path: "/api/channels/3021/fans?option=month&offset=0&limit=10", auth: null }]);
  });

  it("still opens the room when FLEXTV cannot be read", async () => {
    down = true;
    const { getFlextvChannelRanking } = await import("./flextvChannelHome");
    expect(await getFlextvChannelRanking("3021", null)).toMatchObject({ rows: [], unavailable: true });
  });
});

describe("the 소식", () => {
  it("lists the latest, each opening on FLEXTV, and tells whether there are more", async () => {
    token = "member-token";
    const { getFlextvChannelNews } = await import("./flextvChannelHome");
    const news = await getFlextvChannelNews("3021", 3);
    expect(news.items.map((n) => [n.id, n.important, n.href])).toEqual([
      ["1", true, "https://www.flextv.test/channels/3021/feeds/1"],
      ["2", false, "https://www.flextv.test/channels/3021/feeds/2"],
      ["3", false, "https://www.flextv.test/channels/3021/feeds/3"]
    ]);
    expect(news).toMatchObject({ hasMore: true, unavailable: false });
    // With the member's token, so FLEXTV applies its own rules for them.
    expect(calls).toEqual([{ path: "/api/channels/3021/channel-notices?offset=0&limit=4&sort=recent&ver=0", auth: "Bearer member-token" }]);
    expect((await getFlextvChannelNews("3021", 12)).hasMore).toBe(false);
  });

  it("does not ask FLEXTV about what is not a channel id", async () => {
    const { getFlextvChannelNews } = await import("./flextvChannelHome");
    expect(await getFlextvChannelNews("1 OR 1=1", 3)).toMatchObject({ items: [], unavailable: true });
    expect(calls).toEqual([]);
  });
});
