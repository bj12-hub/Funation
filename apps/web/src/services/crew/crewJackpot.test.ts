import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import { DEFAULT_JACKPOT, jackpotRange, type JackpotSettings } from "./crewTypes";

/** Queued server rolls (randomInt) for the next draws; empty = real randomness. */
const rolls = vi.hoisted(() => [] as number[]);
vi.mock("node:crypto", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:crypto")>();
  return {
    ...real,
    randomInt: (...args: Parameters<typeof real.randomInt>) => (rolls.length ? rolls.shift()! : (real.randomInt as (min: number, max: number) => number)(args[0] as number, args[1] as number))
  };
});
vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 시그니처 잭팟 (2026-11-01, StreamDonate 복주머니 모드 as a 점수 풀) on the 점수 게임 engine. */
async function load() {
  const bc = await import("./crewBroadcast");
  const games = await import("./crewGames");
  const core = await import("./crewJackpotCore");
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
    expect(await bc.startBroadcast({ requestId: crypto.randomUUID(), title: "잭팟 방송", teamMode: false })).toEqual({ status: "SAVED" });
    return (await bc.getBroadcastView())!.live!.id;
  };
  const view = async () => (await games.getGamesView())!.live!.jackpot;
  const obs = async () => {
    const overlay = await bc.getOverlayScoreboard(mockCreator.integrationKey);
    if (overlay === "IDLE" || overlay === "FORBIDDEN") throw new Error("no live overlay");
    return overlay.jackpot;
  };
  const gamePoints = async (memberId: string) => (await bc.getBroadcastView())!.live!.rows.find((r) => r.memberId === memberId)!.game;
  return { ...bc, ...games, core, mockCrew, a, sign, start, view, obs, gamePoints };
}

const T0 = new Date("2026-11-01T12:00:00Z");
const at = (sec: number) => new Date(T0.getTime() + sec * 1000);
const settings = (patch: Partial<JackpotSettings> = {}) => ({ ...DEFAULT_JACKPOT, auto: true, ...patch });

describe("시그니처 잭팟", () => {
  beforeEach(() => {
    resetMockStores();
    rolls.length = 0;
    vi.useFakeTimers({ now: T0, toFake: ["Date"] });
  });
  afterEach(() => vi.useRealTimers());

  it("draws the 당첨 순번 from 목표 ± a sixth (StreamDonate: 120 → 100 ~ 140)", () => {
    expect(jackpotRange(120)).toEqual([100, 140]);
    expect(jackpotRange(5)).toEqual([5, 5]);
    expect(jackpotRange(2)).toEqual([2, 2]);
    expect(jackpotRange(1_000)).toEqual([834, 1_166]);
  });

  it("validates and saves the settings", async () => {
    const m = await load();
    expect(await m.saveJackpot(settings({ percent: 5, target: 30, showSec: 12 }))).toEqual({ status: "SAVED" });
    expect((await m.getGamesView())!.jackpotSettings).toMatchObject({ percent: 5, target: 30, showSec: 12, auto: true });
    const bad: [Partial<JackpotSettings>, string][] = [
      [{ percent: 0 }, "적립 비율은 1 ~ 100%"],
      [{ percent: 1.5 }, "적립 비율은"],
      [{ target: 1 }, "목표 개수는 2 ~ 1,000번째"],
      [{ target: 1_001 }, "목표 개수는"],
      [{ showSec: 0 }, "당첨 문구 표시 시간은 1 ~ 60초"],
      [{ excluded: ["sig-nope"] }, "제외할 시그니처"]
    ];
    for (const [patch, message] of bad) {
      const res = await m.saveJackpot(settings(patch));
      expect(res.status === "INVALID" && res.message, message).toContain(message);
    }
    signIn(["SUPPORTER"]);
    expect(await m.saveJackpot(settings())).toEqual({ status: "UNAUTHORIZED" });
  });

  it("adds each 시그니처 후원's share and gives the 풀 to the member at the 당첨 순번, then starts a new 풀", async () => {
    const m = await load();
    await m.saveJackpot(settings({ percent: 10, target: 3 }));
    const id = await m.start();
    rolls.push(3, 4); // this 풀's 당첨 순번, then the next one's
    await m.sign("cm-s1");
    await m.sign("cm-s2");
    let v = await m.view();
    const share = Math.round((m.a.price * 10) / 100);
    expect(v).toMatchObject({ pool: share * 2, count: 2, turn: 3 });
    // Not yet past the 순번: no points.
    expect(v.runs.map((r) => [r.label, r.points])).toEqual([
      [`2번째 · 풀 +${share.toLocaleString("ko-KR")}`, 0],
      [`1번째 · 풀 +${share.toLocaleString("ko-KR")}`, 0]
    ]);

    await m.sign("cm-s2");
    v = await m.view();
    expect(v.runs[0]).toMatchObject({ label: "잭팟 당첨!", kind: "ADD", points: share * 3, memberName: "하늘", jackpot: { pool: share * 3, count: 3, won: true } });
    expect(v).toMatchObject({ pool: 0, count: 0, turn: 4 });
    expect(v.wins).toEqual([expect.objectContaining({ name: "하늘", points: share * 3, count: 3 })]);
    // The points count once the 당첨 shows on OBS.
    vi.setSystemTime(at(60));
    expect(await m.gamePoints("cm-s2")).toBe(share * 3);
    expect(await m.gamePoints("cm-s1")).toBe(0);
    expect(id).toBeTruthy();
  });

  it("keeps the 당첨 순번 off OBS, which only gets how full the 복주머니 looks", async () => {
    const m = await load();
    await m.saveJackpot(settings({ target: 10 }));
    await m.start();
    rolls.push(10);
    await m.sign("cm-s1");
    await m.sign("cm-s1");
    await m.sign("cm-s1");
    expect((await m.view()).turn).toBe(10);
    expect(await m.obs()).toMatchObject({ turn: null, count: 3, fill: 0.3 });
    expect(m.core.jackpotFill(9, 10)).toBe(0.9);
    expect(m.core.jackpotFill(12, 10)).toBe(1);
  });

  it("does not count a 시그니처 후원 without a member, nor play by hand", async () => {
    const m = await load();
    await m.saveJackpot(settings());
    const id = await m.start();
    await m.sign();
    expect((await m.view()).count).toBe(0);
    expect(await m.playGame({ game: "JACKPOT", broadcastId: id, requestId: key(9), memberId: "cm-s1" })).toEqual({ status: "INVALID", message: "시그니처 잭팟은 시그니처 후원으로만 쌓여요." });
  });

  it("starts the 풀 over, sets the 당첨 순번 by hand, and redraws it when the 목표 changes", async () => {
    const m = await load();
    await m.saveJackpot(settings({ target: 60 }));
    const id = await m.start();
    rolls.push(55);
    await m.sign("cm-s1");
    await m.sign("cm-s1");
    expect(await m.setJackpotTurnOf({ broadcastId: id, turn: 2 })).toEqual({ status: "INVALID", message: "당첨 순번은 3 ~ 2,000번째예요(이번 풀은 지금 2번째)." });
    expect(await m.setJackpotTurnOf({ broadcastId: id, turn: 3.5 })).toMatchObject({ status: "INVALID" });
    expect(await m.setJackpotTurnOf({ broadcastId: id, turn: 3 })).toEqual({ status: "SAVED" });
    expect((await m.view()).turn).toBe(3);

    // A new 목표: a new 당첨 순번 past the count, the points and count kept.
    rolls.push(1);
    expect(await m.saveJackpot(settings({ target: 12 }))).toEqual({ status: "SAVED" });
    expect(await m.view()).toMatchObject({ count: 2, turn: 3 });
    await m.saveJackpot(settings({ target: 12, percent: 4 }));
    expect((await m.view()).turn).toBe(3); // the same 목표: the 순번 stays (no draw)

    rolls.push(12);
    expect(await m.resetJackpot({ broadcastId: id })).toEqual({ status: "SAVED" });
    expect(await m.view()).toMatchObject({ pool: 0, count: 0, turn: 12, wins: [] });
    expect(await m.resetJackpot({ broadcastId: "bc-x" })).toEqual({ status: "INVALID", message: "진행 중인 방송이 아니에요." });
  });
});
