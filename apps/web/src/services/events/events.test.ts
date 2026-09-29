import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 이벤트 (code-first): phases from dates, idempotent join only while running, no FN credited. */
describe("이벤트", () => {
  beforeEach(() => resetMockStores());

  it("lists by phase and joins a running event once", async () => {
    const { getEvents, joinEvent, getEvent } = await import("./events");
    const { mockAccount } = await import("@/services/account/mockStore");
    const before = mockAccount.fnBalance;
    const all = await getEvents("all");
    expect(all.items.map((e) => e.phase)).toEqual(["ongoing", "upcoming", "ended"]);
    const ongoing = all.items.find((e) => e.phase === "ongoing")!;
    expect(await joinEvent(ongoing.id)).toEqual({ status: "JOINED" });
    expect(await joinEvent(ongoing.id)).toEqual({ status: "JOINED" });
    const detail = (await getEvent(ongoing.id))!;
    expect(detail).toMatchObject({ joined: true, participants: ongoing.participants + 1 });
    expect((await getEvents("mine")).items.map((e) => e.id)).toEqual([ongoing.id]);
    expect(mockAccount.fnBalance).toBe(before);
  });

  it("rejects joining upcoming / ended / unknown events and signed-out calls", async () => {
    const { getEvents, joinEvent } = await import("./events");
    const all = await getEvents("all");
    for (const e of all.items.filter((x) => x.phase !== "ongoing")) expect(await joinEvent(e.id)).toEqual({ status: "NOT_OPEN" });
    expect(await joinEvent("nope")).toEqual({ status: "NOT_FOUND" });
    signIn(null);
    expect(await joinEvent(all.items[0].id)).toEqual({ status: "UNAUTHORIZED" });
    expect((await getEvents("mine")).items).toHaveLength(0);
  });
});
