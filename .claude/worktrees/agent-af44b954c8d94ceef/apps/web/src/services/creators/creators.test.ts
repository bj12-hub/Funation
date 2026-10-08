import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));

/** 크리에이터 찾기 (funnation structure): 인기순 · 라이브 · 최신순 and the live count. */
describe("creator directory", () => {
  it("sorts by subscribers, filters live creators by viewers, and orders newest first", async () => {
    const { getCreators } = await import("./creators");
    const popular = await getCreators({ sort: "popular" });
    const subs = popular.items.map((c) => c.subscriberCount);
    expect(subs).toEqual([...subs].sort((a, b) => b - a));

    const live = await getCreators({ sort: "live" });
    expect(live.items.every((c) => c.isLive)).toBe(true);
    const viewers = live.items.map((c) => c.viewerCount ?? 0);
    expect(viewers).toEqual([...viewers].sort((a, b) => b - a));
    expect(live.totalCount).toBe(popular.liveCount);
    expect(popular.liveCount).toBeLessThan(popular.totalCount);

    const recent = await getCreators({ sort: "recent" });
    const joined = recent.items.map((c) => c.joinedAt);
    expect(joined).toEqual([...joined].sort().reverse());
  });
});
