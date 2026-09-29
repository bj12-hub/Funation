import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 서브 점수판 (code-first): window-scored boards, one open at a time, frozen on close. */
async function load() {
  const bc = await import("./crewBroadcast");
  const boards = await import("./crewBoards");
  const feed = await import("./crewFeed");
  const core = await import("./crewCore");
  return { ...bc, ...boards, ...feed, ...core };
}

const score = (board: { rows: { memberId: string; score: number }[] }, id: string) => board.rows.find((r) => r.memberId === id)!.score;

describe("서브 점수판", () => {
  beforeEach(() => resetMockStores());
  afterEach(() => vi.useRealTimers());

  it("scores only donations inside each board's window and freezes closed boards", async () => {
    vi.useFakeTimers({ now: new Date("2026-09-30T12:00:00Z"), toFake: ["Date"] });
    const m = await load();
    await m.setMemberKeywords({ memberId: "cm-s2", keywords: ["하늘"] });
    await m.startBroadcast({ title: "테스트", teamMode: false });
    const id = (await m.getBroadcastView())!.live!.id;

    vi.setSystemTime(new Date("2026-09-30T12:01:00Z"));
    await m.simulateDonation({ broadcastId: id, requestId: key(1), fnAmount: 1_000, message: "하늘" }); // before any board
    vi.setSystemTime(new Date("2026-09-30T12:02:00Z"));
    await m.openSubBoard({ broadcastId: id, requestId: key(10), title: "1라운드" });
    await m.openSubBoard({ broadcastId: id, requestId: key(10), title: "1라운드" }); // same request → once
    vi.setSystemTime(new Date("2026-09-30T12:03:00Z"));
    await m.simulateDonation({ broadcastId: id, requestId: key(2), fnAmount: 5_000, message: "하늘" });
    m.attributeMemberDonation("dn-x", "studio", "cm-s1", 7_000);

    vi.setSystemTime(new Date("2026-09-30T12:04:00Z"));
    await m.openSubBoard({ broadcastId: id, requestId: key(11), title: "" }); // closes board 1
    vi.setSystemTime(new Date("2026-09-30T12:05:00Z"));
    await m.simulateDonation({ broadcastId: id, requestId: key(3), fnAmount: 2_000, message: "하늘" });

    const live = (await m.getBroadcastView())!.live!;
    expect(live.subBoards.map((b) => [b.no, b.title, b.closedAt !== null])).toEqual([
      [1, "1라운드", true],
      [2, "서브 2판", false]
    ]);
    expect(score(live.subBoards[0], "cm-s2")).toBe(5_000);
    expect(score(live.subBoards[0], "cm-s1")).toBe(7_000);
    expect(score(live.subBoards[1], "cm-s2")).toBe(2_000);
    // The main board still counts everything.
    expect(live.rows.find((r) => r.memberId === "cm-s2")!.feedFn).toBe(8_000);

    await m.closeSubBoard({ broadcastId: id, no: 2 });
    await m.closeSubBoard({ broadcastId: id, no: 2 }); // no-op
    vi.setSystemTime(new Date("2026-09-30T12:06:00Z"));
    await m.simulateDonation({ broadcastId: id, requestId: key(4), fnAmount: 9_000, message: "하늘" });
    const after = (await m.getBroadcastView())!.live!;
    expect(score(after.subBoards[1], "cm-s2")).toBe(2_000);
  });

  it("limits boards per broadcast and requires a live broadcast and the creator role", async () => {
    const m = await load();
    expect((await m.openSubBoard({ broadcastId: "none", requestId: key(1) })).status).toBe("INVALID");
    await m.startBroadcast({ title: "테스트", teamMode: false });
    const id = (await m.getBroadcastView())!.live!.id;
    for (let i = 0; i < 5; i++) await m.openSubBoard({ broadcastId: id, requestId: key(20 + i) });
    expect((await m.openSubBoard({ broadcastId: id, requestId: key(30) })).status).toBe("INVALID");
    await m.endBroadcast(id);
    signIn(["SUPPORTER"]);
    expect(await m.closeSubBoard({ broadcastId: id, no: 1 })).toEqual({ status: "UNAUTHORIZED" });
  });
});
