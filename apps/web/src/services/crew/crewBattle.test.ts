import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 실시간 배틀 (code-first): BJ 1:1 / A팀 vs B팀, battle timer, window scores, retry safety. */
async function startLive(teamMode = false) {
  const bc = await import("./crewBroadcast");
  const feed = await import("./crewFeed");
  const battle = await import("./crewBattle");
  await feed.setMemberKeywords({ memberId: "cm-s1", keywords: ["길동"] });
  await feed.setMemberKeywords({ memberId: "cm-s2", keywords: ["하늘"] });
  const teams = teamMode ? { "cm-s1": "A", "cm-s2": "B", "cm-s3": "B" } : {};
  expect(await bc.startBroadcast({ title: "배틀 방송", teamMode, teams })).toEqual({ status: "SAVED" });
  const id = (await bc.getBroadcastView())!.live!.id;
  const battles = async () => (await bc.getBroadcastView())!.live!.battles;
  let n = 100;
  const donate = (amount: number, message: string) => feed.simulateDonation({ broadcastId: id, requestId: key(n++), amount, unit: "FN", message });
  return { ...bc, ...feed, ...battle, id, battles, donate };
}

const T0 = new Date("2026-10-03T12:00:00Z").getTime();
const at = (sec: number) => vi.setSystemTime(T0 + sec * 1000);

describe("실시간 배틀", () => {
  beforeEach(() => {
    resetMockStores();
    vi.useFakeTimers({ toFake: ["Date"] });
    at(0);
  });
  afterEach(() => vi.useRealTimers());

  it("scores only what each BJ receives while the battle runs, and ends on time", async () => {
    const { startBattle, donate, battles, id } = await startLive();
    await donate(9_000, "길동"); // before the battle: not counted
    at(10);
    expect(await startBattle({ broadcastId: id, requestId: key(1), mode: "MEMBERS", memberA: "cm-s1", memberB: "cm-s2", durationSec: 60 })).toEqual({ status: "SAVED" });
    expect(await startBattle({ broadcastId: id, requestId: key(1), mode: "MEMBERS", memberA: "cm-s1", memberB: "cm-s2", durationSec: 60 })).toEqual({ status: "SAVED" }); // retry → once
    expect((await startBattle({ broadcastId: id, requestId: key(2), mode: "MEMBERS", memberA: "cm-s1", memberB: "cm-s2", durationSec: 60 })).status).toBe("INVALID"); // one at a time
    at(20);
    await donate(3_000, "길동");
    await donate(5_000, "하늘");
    let b = (await battles())[0];
    expect(b).toMatchObject({ no: 1, title: "배틀 1", running: true, remainingSec: 50, leader: "B" });
    expect(b.sides.map((s) => [s.label, s.score])).toEqual([["길동", 3_000], ["하늘", 5_000]]);

    at(80); // time is up at 70
    await donate(10_000, "길동"); // after the end: not counted
    b = (await battles()).at(-1)!;
    expect(b).toMatchObject({ running: false, remainingSec: 0, leader: "B" });
    expect(b.sides[0].score).toBe(3_000);
  });

  it("adds or takes time once per request, and stopping is double-click safe", async () => {
    const { startBattle, adjustBattleTime, stopBattle, battles, id } = await startLive();
    await startBattle({ broadcastId: id, requestId: key(1), mode: "MEMBERS", memberA: "cm-s1", memberB: "cm-s3", durationSec: 60 });
    await adjustBattleTime({ broadcastId: id, no: 1, deltaSec: 30, requestId: key(2) });
    await adjustBattleTime({ broadcastId: id, no: 1, deltaSec: 30, requestId: key(2) }); // retry
    expect((await battles())[0].remainingSec).toBe(90);
    await adjustBattleTime({ broadcastId: id, no: 1, deltaSec: -60, requestId: key(3) });
    expect((await battles())[0].remainingSec).toBe(30);
    expect((await adjustBattleTime({ broadcastId: id, no: 1, deltaSec: 3 * 3600, requestId: key(4) })).status).toBe("INVALID");

    at(5);
    expect(await stopBattle({ broadcastId: id, no: 1 })).toEqual({ status: "SAVED" });
    at(6);
    expect(await stopBattle({ broadcastId: id, no: 1 })).toEqual({ status: "SAVED" });
    const b = (await battles())[0];
    expect(b).toMatchObject({ running: false, stoppedAt: new Date(T0 + 5000).toISOString(), leader: null });
    expect((await adjustBattleTime({ broadcastId: id, no: 1, deltaSec: 30, requestId: key(5) })).status).toBe("INVALID");
  });

  it("runs A팀 vs B팀 only in team mode, closes with 방송 종료, and shows on the overlay", async () => {
    const plain = await startLive();
    expect((await plain.startBattle({ broadcastId: plain.id, requestId: key(1), mode: "TEAMS", durationSec: 60 })).status).toBe("INVALID");
    expect((await plain.startBattle({ broadcastId: plain.id, requestId: key(2), mode: "MEMBERS", memberA: "cm-s1", memberB: "cm-s1", durationSec: 60 })).status).toBe("INVALID");
    expect((await plain.startBattle({ broadcastId: plain.id, requestId: key(3), mode: "MEMBERS", memberA: "cm-s1", memberB: "cm-s4", durationSec: 60 })).status).toBe("INVALID"); // inactive
    expect((await plain.startBattle({ broadcastId: plain.id, requestId: key(4), mode: "MEMBERS", memberA: "cm-s1", memberB: "cm-s2", durationSec: 5 })).status).toBe("INVALID");
    await plain.endBroadcast(plain.id);
    at(1);

    const { startBattle, donate, endBroadcast, getOverlayScoreboard, battles, id } = await startLive(true);
    const { mockCreator } = await import("@/services/creator/mockCreatorStore");
    await startBattle({ broadcastId: id, requestId: key(5), mode: "TEAMS", durationSec: 300, title: "팀전" });
    await donate(2_000, "길동");
    await donate(1_000, "하늘");
    const live = await getOverlayScoreboard(mockCreator.integrationKey);
    expect(live !== "IDLE" && live !== "FORBIDDEN" && live.battles[0]).toMatchObject({ title: "팀전", mode: "TEAMS", running: true, leader: "A" });
    expect((await battles())[0].sides.map((s) => [s.label, s.memberIds.length, s.score])).toEqual([["A팀", 1, 2_000], ["B팀", 2, 1_000]]);

    at(30);
    await endBroadcast(id);
    signIn(["SUPPORTER"]);
    expect(await startBattle({ broadcastId: id, requestId: key(6), mode: "TEAMS", durationSec: 60 })).toEqual({ status: "UNAUTHORIZED" });
  });
});
