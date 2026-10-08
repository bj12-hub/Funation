import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 크리에이터 랭킹 (Figma 405:4): server-side search, paging and the URL parsers. */
describe("크리에이터 랭킹", () => {
  beforeEach(() => resetMockStores());

  it("is for creators only", async () => {
    const { getCreatorRanking } = await import("./creatorRanking");
    signIn(["SUPPORTER"]);
    expect(await getCreatorRanking({ type: "quest", period: "season" })).toBeNull();
    signIn(null);
    expect(await getCreatorRanking({ type: "quest", period: "season" })).toBeNull();
  });

  it("pages by 30 and clamps the page", async () => {
    const { getCreatorRanking, RANKING_PAGE_SIZE } = await import("./creatorRanking");
    const first = (await getCreatorRanking({ type: "quest", period: "season" }))!;
    expect(first.rows).toHaveLength(RANKING_PAGE_SIZE);
    expect(first.totalPages).toBe(Math.ceil(first.total / RANKING_PAGE_SIZE));
    expect((await getCreatorRanking({ type: "quest", period: "season", page: 999 }))!.page).toBe(first.totalPages);
    for (const page of [0, -3, Number.NaN, 1.7]) expect((await getCreatorRanking({ type: "quest", period: "season", page }))!.page).toBe(1);
    const points = first.rows.map((r) => r.points);
    expect([...points].sort((a, b) => b - a)).toEqual(points);
  });

  it("gives equal points the same rank (competition ranking)", async () => {
    const { getCreatorRanking } = await import("./creatorRanking");
    const all = [];
    const head = (await getCreatorRanking({ type: "quest", period: "day" }))!;
    for (let page = 1; page <= head.totalPages; page++) all.push(...(await getCreatorRanking({ type: "quest", period: "day", page }))!.rows);
    for (let i = 1; i < all.length; i++) {
      if (all[i].points === all[i - 1].points) expect(all[i].rank).toBe(all[i - 1].rank);
      else expect(all[i].rank).toBe(i + 1);
    }
  });

  it("searches names but never masked creators, and trims the query", async () => {
    const { getCreatorRanking, RANKING_QUERY_MAX } = await import("./creatorRanking");
    const found = (await getCreatorRanking({ type: "quest", period: "season", query: "  하루봄 " }))!;
    expect(found.query).toBe("하루봄");
    expect(found.rows.length).toBeGreaterThan(0);
    expect(found.rows.every((r) => r.name?.includes("하루봄"))).toBe(true);
    expect((await getCreatorRanking({ type: "quest", period: "season", query: "*****" }))!.total).toBe(0);
    const empty = (await getCreatorRanking({ type: "quest", period: "season", query: "없는크리에이터" }))!;
    expect(empty).toMatchObject({ total: 0, totalPages: 1, page: 1, rows: [] });
    expect((await getCreatorRanking({ type: "quest", period: "season", query: "가".repeat(50) }))!.query).toHaveLength(RANKING_QUERY_MAX);
  });

  it("falls back to the defaults for unknown URL values", async () => {
    const { parseRankingPeriod, parseRankingType } = await import("./creatorRanking");
    expect(parseRankingPeriod("week")).toBe("week");
    expect(parseRankingPeriod("year")).toBe("season");
    expect(parseRankingPeriod(undefined)).toBe("season");
    expect(parseRankingType("luckybox")).toBe("quest"); // removed 2026-10-04
  });
});
