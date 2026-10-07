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
  expect(await bc.startBroadcast({ requestId: crypto.randomUUID(), title: "배틀 방송", teamMode, teams })).toEqual({ status: "SAVED" });
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

  it("multiplies the battle score by its 배수, keeps the 벌칙, and starts from the channel's defaults", async () => {
    const { startBattle, stopBattle, setBattleRules, donate, battles, getBroadcastView, id } = await startLive();
    const start = (n: number, extra: Record<string, unknown> = {}) =>
      startBattle({ broadcastId: id, requestId: key(n), mode: "MEMBERS", memberA: "cm-s1", memberB: "cm-s2", durationSec: 60, ...extra });
    // Platform defaults (2026-10-05 결정): 1배 · 벌칙 없음.
    expect((await getBroadcastView())!.battleRules).toEqual({ multiplier: 1, penalty: "" });
    expect(await start(1)).toEqual({ status: "SAVED" });
    expect((await battles())[0]).toMatchObject({ multiplier: 1, penalty: "" });
    await stopBattle({ broadcastId: id, no: 1 });

    expect(await setBattleRules({ multiplier: 2, penalty: "  노래 한 곡 " })).toEqual({ status: "SAVED" });
    expect((await getBroadcastView())!.battleRules).toEqual({ multiplier: 2, penalty: "노래 한 곡" });
    at(10);
    expect(await start(2)).toEqual({ status: "SAVED" }); // no 배수 sent → the channel's defaults
    await donate(3_000, "길동");
    await donate(1_000, "하늘");
    const b = (await battles())[1];
    expect(b).toMatchObject({ multiplier: 2, penalty: "노래 한 곡", leader: "A" });
    expect(b.sides.map((s) => s.score)).toEqual([6_000, 2_000]);
    // The main scoreboard counts the battle points × 배수 too (2026-10-05 결정), shown as its own part.
    const row = (await getBroadcastView())!.live!.rows.find((r) => r.memberId === "cm-s1")!;
    expect(row).toMatchObject({ feed: 3_000, battle: 3_000, score: 6_000 });
    await stopBattle({ broadcastId: id, no: 2 });

    // Changed for one battle only.
    expect(await start(3, { multiplier: 1.5, penalty: "" })).toEqual({ status: "SAVED" });
    expect((await battles())[2]).toMatchObject({ multiplier: 1.5, penalty: "" });
    await stopBattle({ broadcastId: id, no: 3 });
    expect((await getBroadcastView())!.battleRules.multiplier).toBe(2);

    for (const bad of [{ multiplier: 0 }, { multiplier: 11 }, { multiplier: 1.234 }, { multiplier: 2, penalty: "가".repeat(41) }, { multiplier: 2, penalty: "admin 벌칙" }]) {
      expect((await setBattleRules({ penalty: "", ...bad })).status).toBe("INVALID");
    }
    expect((await start(4, { multiplier: -1 })).status).toBe("INVALID");
    expect(await setBattleRules({ reset: true })).toEqual({ status: "SAVED" });
    expect((await getBroadcastView())!.battleRules).toEqual({ multiplier: 1, penalty: "" });
    signIn(["SUPPORTER"]);
    expect(await setBattleRules({ multiplier: 3, penalty: "" })).toEqual({ status: "UNAUTHORIZED" });
  });

  it("keeps the 배틀 배수 in team scores and in the frozen final ranking", async () => {
    const { startBattle, stopBattle, endBroadcast, getBroadcastView, donate, id } = await startLive(true);
    await donate(1_000, "하늘"); // before the battle: counted once
    at(10);
    expect(await startBattle({ broadcastId: id, requestId: key(1), mode: "TEAMS", durationSec: 60, multiplier: 3, penalty: "" })).toEqual({ status: "SAVED" });
    await donate(1_000, "길동");
    await donate(2_000, "하늘");
    at(30);
    await stopBattle({ broadcastId: id, no: 1 });
    at(31);
    await donate(1_000, "길동"); // after the battle: counted once
    const live = (await getBroadcastView())!.live!;
    const byId = Object.fromEntries(live.rows.map((r) => [r.memberId, r]));
    // ×3 battle: what each member received during it (길동 1,000 · 하늘 2,000) counts 2 more times.
    expect([byId["cm-s1"].battle, byId["cm-s2"].battle, byId["cm-s3"].battle]).toEqual([2_000, 4_000, 0]);
    for (const r of live.rows) expect(r.score).toBe(r.donated + r.feed + r.adjust + r.stolen + r.battle);
    expect(live.teams).toEqual([
      { key: "A", score: byId["cm-s1"].score },
      { key: "B", score: byId["cm-s2"].score + byId["cm-s3"].score }
    ]);
    expect(live.battles[0].sides.map((s) => s.score)).toEqual([3_000, 6_000]);
    const total = live.rows.reduce((sum, r) => sum + r.score, 0);
    await endBroadcast(id);
    expect((await getBroadcastView())!.history[0].totalScore).toBe(total);
  });
});
