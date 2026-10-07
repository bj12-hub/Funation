import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

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

  it("hides a suspended creator while suspended and shows it again after (2026-10-08 결정)", async () => {
    const m = await import("./favorites");
    const { suspendMember, restoreMember } = await import("@/services/admin/members");
    const { creatorMemberId } = await import("@/services/admin/memberCore");
    const OP = { userId: "adm-test", nickname: "테스트 운영자" };
    const before = (await m.getFavorites({}))!;
    expect(before.items.map((f) => f.creatorId)).toContain("c4");

    expect(await suspendMember(OP, { id: creatorMemberId("c4"), days: 7, reason: "운영 정책 위반 (테스트)", requestId: key(1) })).toEqual({ status: "OK" });
    const hidden = (await m.getFavorites({}))!;
    expect(hidden.items.map((f) => f.creatorId)).not.toContain("c4");
    expect(hidden.totalCount).toBe(before.totalCount - 1);
    // A search for it finds nothing, so the page shows its empty state.
    expect((await m.getFavorites({ query: "불꽃크루" }))!).toMatchObject({ items: [], totalCount: 0, totalPages: 1 });

    expect(await restoreMember(OP, { id: creatorMemberId("c4"), reason: "소명 확인 후 해제" })).toEqual({ status: "OK" });
    expect((await m.getFavorites({}))!).toMatchObject({ totalCount: before.totalCount, items: before.items });
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
