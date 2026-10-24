import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import { DEFAULT_GOSTOP, goStopBand, goStopRanking, type GoStopSettings } from "./crewTypes";

/** Queued server rolls (randomInt) for the next draws; empty = real randomness. */
const rolls = vi.hoisted(() => [] as number[]);
vi.mock("node:crypto", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:crypto")>();
  return { ...real, randomInt: (...args: Parameters<typeof real.randomInt>) => (rolls.length ? rolls.shift()! : (real.randomInt as (max: number) => number)(args[0] as number)) };
});
vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 고스톱 (2026-10-24, StreamDonate 고스톱 참고) on the 점수 게임 engine. */
async function load() {
  const bc = await import("./crewBroadcast");
  const games = await import("./crewGames");
  const core = await import("./crewGoStopCore");
  const { mockCrew } = await import("./mockCrewStore");
  const { mockCreator } = await import("@/services/creator/mockCreatorStore");
  const { mockAccount } = await import("@/services/account/mockStore");
  const { requestDonation } = await import("@/services/donations/donate");
  const signatures = await import("@/services/donations/signatures");
  // The session's donations go to the studio channel (its crew and live broadcast).
  const creators = await import("@/services/creators/creators");
  const c1 = (await creators.getCreatorById("c1"))!;
  vi.spyOn(creators, "getCreatorById").mockResolvedValue({ ...c1, id: "studio" });
  mockAccount.fnBalance = 10_000_000;
  const [a] = (await signatures.listSignatures())!;
  let n = 0;
  const sign = (memberId?: string) =>
    requestDonation({ creatorId: "studio", hideProfile: false, type: "SIGNATURE", signatureId: a.id, message: "", amount: a.price, expectedAmount: a.price, idempotencyKey: key(++n), memberId });
  // The seed attributions are stamped when the store is made (T0): the broadcast starts a second later.
  const start = async () => {
    vi.setSystemTime(at(1));
    expect(await bc.startBroadcast({ requestId: crypto.randomUUID(), title: "고스톱 방송", teamMode: false })).toEqual({ status: "SAVED" });
    return (await bc.getBroadcastView())!.live!.id;
  };
  const view = async () => (await games.getGamesView())!.live!.gostop;
  const runs = (id: string) => (mockCrew.broadcasts!.find((x) => x.id === id)!.gameRuns ?? []).filter((r) => r.game === "GOSTOP");
  const gamePoints = async (memberId: string) => (await bc.getBroadcastView())!.live!.rows.find((r) => r.memberId === memberId)!.game;
  return { ...bc, ...games, core, a, sign, start, view, runs, gamePoints, overlayKey: mockCreator.integrationKey };
}

const T0 = new Date("2026-10-24T12:00:00Z");
const at = (sec: number) => new Date(T0.getTime() + sec * 1000);
const settings = (patch: Partial<GoStopSettings> = {}) => ({ ...DEFAULT_GOSTOP, auto: true, ...patch });
const GO = 999_999;
const STOP = 0;

describe("고스톱 확률 · 색 구간", () => {
  it("rolls STOP by the donation's points, up to the 최대", async () => {
    const { goStopChance } = await import("./crewGoStopCore");
    const s = { stopRate: 0.05, stopMax: 50 };
    // Per million: 0.05% per 1,000 points.
    expect([0, 1_000, 13_920, 2_000_000].map((p) => goStopChance(s, p))).toEqual([0, 500, 6_960, 500_000]);
    expect(goStopChance({ stopRate: 2.5, stopMax: 10 }, 30_000)).toBe(100_000);
  });

  it("shows the 풀 in the last 색 구간 it reached", () => {
    const bands = [
      { id: "b2", min: 50_000, color: "#eab308" },
      { id: "b1", min: 0, color: "#22c55e" }
    ];
    expect([0, 49_999, 50_000, 1_000_000].map((p) => goStopBand(bands, p)?.id)).toEqual(["b1", "b1", "b2", "b2"]);
    expect(goStopBand([{ id: "b", min: 100, color: "#000000" }], 10)).toBeNull();
  });

  it("ranks members by what their STOPs took", () => {
    const win = (memberId: string, points: number, pool: number) => ({ memberId, name: memberId, color: null, points, pool });
    expect(goStopRanking([win("a", 1_000, 1_000), win("b", 3_000, 1_500), win("a", 2_500, 2_500), win("c", 3_500, 3_500)])).toEqual([
      { memberId: "a", name: "a", color: null, points: 3_500, count: 2, best: 2_500 },
      { memberId: "c", name: "c", color: null, points: 3_500, count: 1, best: 3_500 },
      { memberId: "b", name: "b", color: null, points: 3_000, count: 1, best: 1_500 }
    ]);
  });
});

describe("고스톱", () => {
  beforeEach(() => {
    resetMockStores();
    rolls.length = 0;
    vi.useFakeTimers({ now: T0, toFake: ["Date"] });
  });
  afterEach(() => vi.useRealTimers());

  it("validates and saves the settings", async () => {
    const m = await load();
    const bands = [
      { id: "new-1", min: 100_000, color: "#EF4444" },
      { id: "new-2", min: 0, color: "#22c55e" }
    ];
    expect(await m.saveGoStop(settings({ poolPercent: 50, stopRate: 0.5, stopMax: 30, multiplier: 1.5, bands, excludedMembers: ["cm-s3", "cm-s3"] }))).toEqual({ status: "SAVED" });
    const saved = (await m.getGamesView())!.gostopSettings;
    expect(saved).toMatchObject({ poolPercent: 50, stopRate: 0.5, stopMax: 30, multiplier: 1.5, excludedMembers: ["cm-s3"] });
    expect(saved.bands.map((b) => [b.min, b.color])).toEqual([
      [0, "#22c55e"],
      [100_000, "#ef4444"]
    ]);
    expect(saved.bands.every((b) => b.id.startsWith("gb-"))).toBe(true);
    expect(await m.saveGoStop({ ...saved, bands: saved.bands.slice(1) })).toEqual({ status: "SAVED" });
    expect((await m.getGamesView())!.gostopSettings.bands.map((b) => b.id)).toEqual([saved.bands[1].id]);

    const band = (b: Record<string, unknown>) => [{ id: "x", min: 0, color: "#000000", ...b }];
    const bad: [Record<string, unknown>, string][] = [
      [{ poolPercent: 0 }, "적립률은 1 ~ 1000%"],
      [{ poolPercent: 1001 }, "적립률은"],
      [{ poolPercent: 1.5 }, "적립률은"],
      [{ stopRate: 0 }, "STOP 확률은 1,000점당 0.01 ~ 10%"],
      [{ stopRate: 10.5 }, "STOP 확률은"],
      [{ stopRate: 0.001 }, "STOP 확률은"],
      [{ stopMax: 0 }, "최대 STOP 확률은 1 ~ 100%"],
      [{ stopMax: 101 }, "최대 STOP 확률은"],
      [{ multiplier: 0.5 }, "STOP 배수는 1 ~ 10배"],
      [{ multiplier: 11 }, "STOP 배수는"],
      [{ bands: Array.from({ length: 6 }, (_, i) => ({ id: `b${i}`, min: i, color: "#000000" })) }, "색 구간은 5개까지"],
      [{ bands: band({ color: "red" }) }, "최소 풀과 색"],
      [{ bands: band({ min: -1 }) }, "최소 풀과 색"],
      [{ bands: [...band({}), { id: "y", min: 0, color: "#ffffff" }] }, "최소 풀이 겹쳐요"],
      [{ excludedMembers: ["cm-nope"] }, "제외 BJ를 확인"],
      [{ excluded: ["sig-nope"] }, "제외할 시그니처"]
    ];
    for (const [patch, message] of bad) {
      const res = await m.saveGoStop(settings(patch as Partial<GoStopSettings>));
      expect(res.status === "INVALID" && res.message, message).toContain(message);
    }
    signIn(["SUPPORTER"]);
    expect(await m.saveGoStop(settings())).toEqual({ status: "UNAUTHORIZED" });
  });

  it("a 시그니처 후원 to a member adds to the 풀 and rolls: GO counts on, STOP takes the 풀 × 배수", async () => {
    const m = await load();
    const id = await m.start();
    await m.saveGoStop(settings({ poolPercent: 50, multiplier: 2, excludedMembers: ["cm-s3"] }));
    const p = m.a.price;
    const share = Math.round(p / 2);
    const chance = Math.round(p * 0.05 * 10);
    rolls.push(GO);
    await m.sign("cm-s2");
    rolls.push(GO);
    await m.sign("cm-s1");
    expect(await m.view()).toMatchObject({ pool: share * 2, go: 2 });
    await m.sign("cm-s3"); // 제외 BJ: no roll, no 풀
    await m.sign(); // no member
    expect((await m.view()).pool).toBe(share * 2);
    rolls.push(STOP);
    await m.sign("cm-s2");
    expect(m.runs(id).map((r) => [r.memberId, r.label, r.kind, r.points, r.gostop])).toEqual([
      ["cm-s2", "1 GO", "TEXT", 0, { pool: share, go: 1, chance }],
      ["cm-s1", "2 GO", "TEXT", 0, { pool: share * 2, go: 2, chance }],
      ["cm-s2", "STOP!", "ADD", share * 3 * 2, { pool: share * 3, go: 2, chance }]
    ]);
    const view = await m.view();
    expect(view).toMatchObject({ pool: 0, go: 0 });
    expect(view.runs[0].gostop).toEqual({ pool: share * 3, go: 2, chance: chance / 10_000 });
    expect(view.wins.map((w) => [w.name, w.points, w.pool, w.go])).toEqual([["하늘", share * 6, share * 3, 2]]);
    // The STOP counts once it shows on OBS.
    expect(await m.gamePoints("cm-s2")).toBe(0);
    vi.setSystemTime(at(120));
    expect(await m.gamePoints("cm-s2")).toBe(share * 6);
    const obs = await m.getOverlayScoreboard(m.overlayKey);
    expect(obs !== "IDLE" && obs !== "FORBIDDEN" && obs.gostop.wins).toHaveLength(1);

    // Off: no roll.
    await m.saveGoStop(settings({ auto: false }));
    await m.sign("cm-s2");
    expect(m.runs(id)).toHaveLength(3);
  });

  it("lets the operator roll on a 기준 후원 and empty the 풀", async () => {
    const m = await load();
    const id = await m.start();
    await m.saveGoStop(settings({ auto: false }));
    await m.sign("cm-s2");
    const play = (requestId: string, sourceId: string | null) => m.playGame({ game: "GOSTOP", broadcastId: id, requestId, memberId: "cm-s2", sourceId });
    // Without a 기준 후원 the 풀 gets nothing and there is no STOP 확률: always GO.
    expect(await play(key(1), null)).toMatchObject({ status: "PLAYED", run: { label: "1 GO", gostop: { pool: 0, go: 1, chance: 0 } } });
    const source = (await m.getGamesView())!.live!.sources.GOSTOP["cm-s2"][0];
    rolls.push(STOP);
    const res = await play(key(2), source.id);
    expect(res).toMatchObject({ status: "PLAYED", run: { label: "STOP!", points: m.a.price, trigger: { kind: "MANUAL" } } });
    expect(await play(key(2), source.id)).toEqual(res); // retried: the same roll
    expect(await play(key(3), source.id)).toEqual({ status: "INVALID", message: "이 게임을 이미 돌린 후원이에요." });

    rolls.push(GO);
    await m.sign("cm-s2");
    await play(key(4), (await m.getGamesView())!.live!.sources.GOSTOP["cm-s2"][0].id);
    expect((await m.view()).pool).toBe(m.a.price);
    expect(await m.resetGoStop({ broadcastId: id })).toEqual({ status: "SAVED" });
    expect(await m.view()).toMatchObject({ pool: 0, go: 0 });
    expect(m.runs(id)).toHaveLength(3); // emptying the 풀 is no run
    expect(await m.resetGoStop({ broadcastId: "bc-x" })).toEqual({ status: "INVALID", message: "진행 중인 방송이 아니에요." });
    signIn(["SUPPORTER"]);
    expect(await m.resetGoStop({ broadcastId: id })).toEqual({ status: "UNAUTHORIZED" });
  });
});
