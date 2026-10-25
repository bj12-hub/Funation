import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Phase 7: 크리에이터 찾기 and the home on FLEXTV's channels, against a stubbed FLEXTV API. */

vi.mock("@/lib/flextv/mode", () => ({ FLEXTV_BACKEND: true, FLEXTV_LIVE: true, FLEXTV_SITE: true, FLEXTV_WEB_URL: "https://www.flextv.test" }));

const owner = (n: number) => ({ loginId: `bj${n}`, nickname: `방송인${n}`, thumbUrl: `https://cdn.flextv.test/${n}.png` });
const ranked = Array.from({ length: 13 }, (_, i) => ({ id: 3000 + i, name: `방송국${i}`, description: `소개${i}`, isInLive: i === 2, stat: { numberOfSubs: 100 - i }, owner: owner(i), playerCount: 0 }));
const live = [
  { channelId: 3002, title: "저녁 방송", thumbUrl: "https://cdn.flextv.test/t2.jpg", startedAt: "2026-10-25T10:00:00.000Z", owner: owner(2), playerCount: 40 },
  { channelId: 3050, title: "새벽 방송", thumbUrl: "https://cdn.flextv.test/t50.jpg", startedAt: "2026-10-25T09:00:00.000Z", owner: owner(50), playerCount: 90 }
];
let searched: string[];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("FLEXTV_API_URL", "https://api.flextv.test");
  const g = globalThis as Record<string, unknown>;
  delete g.__ssumnationFlextvRanking;
  delete g.__ssumnationFlextvLive;
  searched = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = new URL(url);
      switch (u.pathname) {
        case "/api/channels/rankings":
          return json({ data: ranked, count: ranked.length });
        case "/api/channels/searchRankings":
          searched.push(u.searchParams.get("name")!);
          return json({ data: ranked.filter((r) => r.owner.nickname.includes(u.searchParams.get("name")!)), count: 1 });
        case "/api/channels/live-list-main":
          return json({ data: live, count: live.length });
        default:
          throw new Error(`unexpected FLEXTV call ${u.pathname}`);
      }
    })
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("크리에이터 찾기", () => {
  it("lists FLEXTV's ranking as rooms, paged here, with the live viewers", async () => {
    const { flextvCreatorsPage } = await import("./flextvCreators");
    const page = await flextvCreatorsPage({});
    expect(page).toMatchObject({ page: 1, totalPages: 2, totalCount: 13, liveCount: 2 });
    expect(page.items[0]).toEqual({
      id: "3000",
      name: "방송인0",
      avatarUrl: "https://cdn.flextv.test/0.png",
      description: "소개0",
      categories: [],
      isLive: false,
      isNew: false,
      viewerCount: null,
      subscriberCount: 100,
      joinedAt: "",
      ring: "plain"
    });
    expect(page.items[2]).toMatchObject({ id: "3002", isLive: true, viewerCount: 40 });
    expect((await flextvCreatorsPage({ page: 2 })).items.map((c) => c.id)).toEqual(["3010", "3011", "3012"]);
  });

  it("lists the live channels by viewers, and searches with FLEXTV's 방송국 검색", async () => {
    const { flextvCreatorsPage } = await import("./flextvCreators");
    expect((await flextvCreatorsPage({ sort: "live" })).items.map((c) => [c.id, c.viewerCount])).toEqual([
      ["3050", 90],
      ["3002", 40]
    ]);
    const found = await flextvCreatorsPage({ query: "방송인1" });
    expect(searched).toEqual(["방송인1"]);
    expect(found.items.map((c) => c.id)).toEqual(["3001", "3010", "3011", "3012"]);
  });
});

describe("the home", () => {
  it("shows FLEXTV's most watched streams and its ranking, without Ssumnation's own promotion", async () => {
    const { flextvHomeFeed } = await import("@/services/home/flextvHomeFeed");
    const feed = await flextvHomeFeed();
    expect(feed.heroSlides.map((s) => s.href)).toEqual(["/creators/3050", "/creators/3002"]);
    expect(feed.trending[0]).toMatchObject({ rank: 1, title: "새벽 방송", isLive: true, viewerCount: 90 });
    expect(feed.creators).toHaveLength(10);
    expect(feed.creators[0]).toMatchObject({ id: "3000", href: "/creators/3000", profile: { verified: false, tags: [] } });
    expect(feed.promotion).toBeNull();
    expect(feed.notices).toEqual([]);
  });
});
