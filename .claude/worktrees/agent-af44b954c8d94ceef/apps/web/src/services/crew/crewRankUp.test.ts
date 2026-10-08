import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import { rankUpPair } from "./crewTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

const row = (memberId: string, score: number) => ({ memberId, name: memberId, score });

/** 랭크업 (code-first, 2026-10-06): the closest overtake on the scoreboard, and its OBS toggle. */
describe("랭크업", () => {
  beforeEach(() => resetMockStores());

  it("picks the neighbours with the smallest gap (the higher pair on a tie)", () => {
    expect(rankUpPair([row("a", 10_000), row("b", 7_000), row("c", 6_500), row("d", 1_000)])).toMatchObject({
      upper: { memberId: "b", rank: 2 },
      lower: { memberId: "c", rank: 3 },
      gap: 500
    });
    expect(rankUpPair([row("a", 5_000), row("b", 4_000), row("c", 3_000)])).toMatchObject({ upper: { memberId: "a" }, gap: 1_000 });
    expect(rankUpPair([row("a", 3_000), row("b", 3_000)])).toMatchObject({ gap: 0 }); // 동점
  });

  it("waits until someone above has points", () => {
    expect(rankUpPair([])).toBeNull();
    expect(rankUpPair([row("a", 1_000)])).toBeNull();
    expect(rankUpPair([row("a", 0), row("b", 0)])).toBeNull();
    // Zero-score members below the last scorer are not compared with each other.
    expect(rankUpPair([row("a", 2_000), row("b", 0), row("c", 0)])).toMatchObject({ upper: { memberId: "a" }, lower: { memberId: "b" } });
  });

  it("is part of the live view and shows on the OBS scoreboard only when switched on", async () => {
    const bc = await import("./crewBroadcast");
    const feed = await import("./crewFeed");
    const { mockCreator } = await import("@/services/creator/mockCreatorStore");
    await feed.setMemberKeywords({ memberId: "cm-s1", keywords: ["길동"] });
    await bc.startBroadcast({ requestId: crypto.randomUUID(), title: "랭크업 방송", teamMode: false, teams: {} });
    const live = (await bc.getBroadcastView())!.live!;
    await feed.simulateDonation({ broadcastId: live.id, requestId: key(1), amount: 2_000, unit: "FN", message: "길동" });
    let overlay = await bc.getOverlayScoreboard(mockCreator.integrationKey);
    if (overlay === "IDLE" || overlay === "FORBIDDEN") throw new Error(String(overlay));
    expect(overlay.rankUp).not.toBeNull();
    expect(overlay.showRankUp).toBe(false);
    expect(await bc.setRankUpOverlay({ broadcastId: live.id, on: true })).toEqual({ status: "SAVED" });
    expect((await bc.setRankUpOverlay({ broadcastId: "other", on: true })).status).toBe("INVALID");
    expect((await bc.setRankUpOverlay({ broadcastId: live.id, on: "yes" })).status).toBe("INVALID");
    overlay = await bc.getOverlayScoreboard(mockCreator.integrationKey);
    if (overlay === "IDLE" || overlay === "FORBIDDEN") throw new Error(String(overlay));
    expect(overlay.showRankUp).toBe(true);
    signIn(["SUPPORTER"]);
    expect(await bc.setRankUpOverlay({ broadcastId: live.id, on: false })).toEqual({ status: "UNAUTHORIZED" });
  });
});
