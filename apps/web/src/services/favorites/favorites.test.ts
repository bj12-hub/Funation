import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 즐겨찾기: members only; adding is idempotent and checks the creator exists; search and pages on the server. */
describe("즐겨찾기", () => {
  beforeEach(() => resetMockStores());

  it("adds once, removes, and answers false for guests", async () => {
    const m = await import("./favorites");
    const before = (await m.getFavorites({}))!.totalCount;
    expect(await m.removeFavorite("c1")).toEqual({ status: "REMOVED" });
    expect(await m.removeFavorite("c1")).toEqual({ status: "NOT_FOUND" });
    expect(await m.isFavorite("c1")).toBe(false);
    expect(await m.addFavorite("c1")).toEqual({ status: "ADDED" });
    expect(await m.addFavorite("c1")).toEqual({ status: "ADDED" });
    expect((await m.getFavorites({}))!.totalCount).toBe(before);
    expect((await m.getFavorites({}))!.items[0].creatorId).toBe("c1");
    expect(await m.addFavorite("no-such-creator")).toEqual({ status: "NOT_FOUND" });
    expect(await m.addFavorite(42)).toEqual({ status: "NOT_FOUND" });
    signIn(null);
    expect(await m.isFavorite("c1")).toBe(false);
    expect(await m.getFavorites({})).toBeNull();
    expect(await m.addFavorite("c2")).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.removeFavorite("c2")).toEqual({ status: "UNAUTHORIZED" });
  });

  it("searches by name and clamps the page", async () => {
    const m = await import("./favorites");
    const first = (await m.getFavorites({}))!.items[0];
    const part = first.name.slice(0, 2);
    const found = (await m.getFavorites({ query: `  ${part} ` }))!;
    expect(found.items.length).toBeGreaterThan(0);
    expect(found.items.every((f) => f.name.includes(part))).toBe(true);
    expect((await m.getFavorites({ query: "없는이름" }))!).toMatchObject({ totalCount: 0, page: 1, totalPages: 1 });
    expect((await m.getFavorites({ page: 999 }))!.page).toBe(1);
  });
});
