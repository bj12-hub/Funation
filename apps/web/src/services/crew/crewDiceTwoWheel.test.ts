import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import { DEFAULT_DICE, DEFAULT_SPIN, DEFAULT_TWO_WHEEL, diceMultiplier, type DiceSettings, type TwoWheelSettings } from "./crewTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 점수 게임 (2026-10-23, StreamDonate 참고, P2): 주사위 게임 · 투휠 게임 on the shared engine. */
async function load() {
  const bc = await import("./crewBroadcast");
  const games = await import("./crewGames");
  const signatures = await import("@/services/donations/signatures");
  const { mockCrew } = await import("./mockCrewStore");
  const { mockCreator } = await import("@/services/creator/mockCreatorStore");
  const { mockAccount } = await import("@/services/account/mockStore");
  const { requestDonation } = await import("@/services/donations/donate");
  // The session's donations go to the studio channel (its crew and live broadcast).
  const creators = await import("@/services/creators/creators");
  const c1 = (await creators.getCreatorById("c1"))!;
  vi.spyOn(creators, "getCreatorById").mockResolvedValue({ ...c1, id: "studio" });
  mockAccount.fnBalance = 1_000_000;
  const [a, b] = (await signatures.listSignatures())!;
  let n = 0;
  const sign = (signatureId: string, price: number, memberId?: string) =>
    requestDonation({ creatorId: "studio", hideProfile: false, type: "SIGNATURE", signatureId, message: "", amount: price, expectedAmount: price, idempotencyKey: key(++n), memberId });
  // The seed attributions are stamped when the store is made (T0): the broadcast starts a second later.
  const start = async () => {
    vi.setSystemTime(at(1));
    expect(await bc.startBroadcast({ requestId: crypto.randomUUID(), title: "게임 방송", teamMode: false })).toEqual({ status: "SAVED" });
    return (await bc.getBroadcastView())!.live!.id;
  };
  const runs = (id: string) => mockCrew.broadcasts!.find((x) => x.id === id)!.gameRuns ?? [];
  return { ...bc, ...games, mockCrew, a, b, sign, start, runs, overlayKey: mockCreator.integrationKey };
}

const T0 = new Date("2026-10-23T12:00:00Z");
const at = (sec: number) => new Date(T0.getTime() + sec * 1000);
const dice = (patch: Partial<DiceSettings> = {}) => ({ ...DEFAULT_DICE, ...patch });
const wheel = (patch: Partial<TwoWheelSettings> = {}) => ({ ...DEFAULT_TWO_WHEEL, ...patch });
/** Only +n (or only ×n) can come up. */
const only = (op: "ADD" | "MULTIPLY", n: number) =>
  op === "ADD"
    ? { plusWeight: 1, timesWeight: 0, plusWeights: DEFAULT_TWO_WHEEL.plusWeights.map((_, i) => (i === n - 1 ? 1 : 0)) }
    : { plusWeight: 0, timesWeight: 1, timesWeights: DEFAULT_TWO_WHEEL.timesWeights.map((_, i) => (i === n - 1 ? 1 : 0)) };

describe("주사위 룰", () => {
  it("turns two dice into a 배수 (StreamDonate 룰 1 · 룰 2)", () => {
    const rule1: [number, number, number][] = [
      [1, 2, 1],
      [2, 4, 1],
      [2, 5, 2],
      [6, 5, 2],
      [1, 1, 2],
      [3, 3, 6],
      [6, 6, 12]
    ];
    for (const [a, b, m] of rule1) expect(diceMultiplier("RULE1", a, b), `${a}+${b}`).toBe(m);
    const rule2: [number, number, number][] = [
      [1, 2, 2],
      [3, 4, 2],
      [2, 6, 3],
      [4, 6, 3],
      [5, 6, 4],
      [1, 1, 4],
      [4, 4, 6],
      [6, 6, 8]
    ];
    for (const [a, b, m] of rule2) expect(diceMultiplier("RULE2", a, b), `${a}+${b}`).toBe(m);
  });
});

describe("주사위 게임 · 투휠 게임", () => {
  beforeEach(() => {
    resetMockStores();
    vi.useFakeTimers({ now: T0, toFake: ["Date"] });
  });
  afterEach(() => vi.useRealTimers());

  it("validates and saves both games' settings", async () => {
    const m = await load();
    expect(await m.saveDiceGame(dice({ title: " 주사위 ", rule: "RULE2", auto: true, excluded: [m.a.id] }))).toEqual({ status: "SAVED" });
    expect(await m.saveTwoWheel(wheel({ plusUnit: 10_000, ...only("MULTIPLY", 3) }))).toEqual({ status: "SAVED" });
    const view = (await m.getGamesView())!;
    expect(view.diceSettings).toEqual({ title: "주사위", auto: true, excluded: [m.a.id], showIdle: true, rule: "RULE2" });
    expect(view.twoWheelSettings).toMatchObject({ plusUnit: 10_000, plusWeight: 0, timesWeight: 1, timesWeights: [0, 0, 1, 0, 0] });

    const badDice: [Record<string, unknown>, string][] = [
      [{ rule: "RULE3" }, "룰"],
      [{ title: "가".repeat(21) }, "제목"],
      [{ title: "운영자 주사위" }, "사용할 수 없는"],
      [{ excluded: ["sig-nope"] }, "제외할 시그니처"],
      [{ auto: "on" }, "설정"]
    ];
    for (const [patch, message] of badDice) {
      const res = await m.saveDiceGame(dice(patch as Partial<DiceSettings>));
      expect(res.status === "INVALID" && res.message, message).toContain(message);
    }
    const badWheel: [Record<string, unknown>, string][] = [
      [{ plusWeight: 101 }, "가중치"],
      [{ timesWeight: -1 }, "가중치"],
      [{ plusWeight: 0, timesWeight: 0 }, "+ 와 ×"],
      [{ plusWeights: [1, 2, 3] }, "가중치"],
      [{ timesWeights: [1, 1, 1, 1, 1.5] }, "가중치"],
      [{ plusWeights: Array(10).fill(0) }, "+ 숫자"],
      [{ timesWeights: Array(5).fill(0) }, "× 숫자"],
      [{ plusUnit: 0 }, "+1 점수"],
      [{ plusUnit: 1_000_001 }, "+1 점수"],
      [{ showIdle: null }, "설정"]
    ];
    for (const [patch, message] of badWheel) {
      const res = await m.saveTwoWheel(wheel(patch as Partial<TwoWheelSettings>));
      expect(res.status === "INVALID" && res.message, message).toContain(message);
    }
    // An operator that cannot come up may have no numbers.
    expect(await m.saveTwoWheel(wheel({ timesWeight: 0, timesWeights: Array(5).fill(0) }))).toEqual({ status: "SAVED" });
    signIn(["SUPPORTER"]);
    expect(await m.saveDiceGame(dice())).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.saveTwoWheel(wheel())).toEqual({ status: "UNAUTHORIZED" });
  });

  it("rolls the dice on the server and multiplies the 기준 후원 by the rule's 배수", async () => {
    const m = await load();
    const id = await m.start();
    await m.saveDiceGame(dice({ rule: "RULE2" }));
    await m.sign(m.a.id, m.a.price, "cm-s2");
    const source = (await m.getGamesView())!.live!.sources.DICE["cm-s2"][0];
    const res = await m.playGame({ game: "DICE", broadcastId: id, requestId: key(1), memberId: "cm-s2", sourceId: source.id });
    if (res.status !== "PLAYED") throw new Error(JSON.stringify(res));
    const [d1, d2] = res.run.dice!;
    for (const d of [d1, d2]) {
      expect(d).toBeGreaterThanOrEqual(1);
      expect(d).toBeLessThanOrEqual(6);
    }
    const mult = diceMultiplier("RULE2", d1, d2);
    expect(res.run).toMatchObject({ game: "DICE", kind: "MULTIPLY", value: mult, basePoints: m.a.price, points: m.a.price * (mult - 1), label: `${d1} + ${d2}${d1 === d2 ? " 더블" : ""}` });
    // OBS ?dice: starts after the lead time, rolls for 3 s.
    expect(res.run).toMatchObject({ showAt: at(4).toISOString(), revealAt: at(7).toISOString() });
    const overlay = await m.getOverlayScoreboard(m.overlayKey);
    expect(overlay !== "IDLE" && overlay !== "FORBIDDEN" && overlay.dice.runs.map((r) => r.id)).toEqual([res.run.id]);

    // The donation can still start the other games, not the dice again.
    expect(await m.playGame({ game: "DICE", broadcastId: id, requestId: key(2), memberId: "cm-s2", sourceId: source.id })).toEqual({ status: "INVALID", message: "이 게임을 이미 돌린 후원이에요." });
    expect((await m.getGamesView())!.live!.sources.TWO_WHEEL["cm-s2"].map((x) => x.id)).toContain(source.id);
    expect(await m.playGame({ game: "BINGO", broadcastId: id, requestId: key(3), memberId: "cm-s2" })).toEqual({ status: "INVALID", message: "게임을 골라 주세요." });
  });

  it("adds +n × the +1 점수, or multiplies the 기준 후원 by ×n", async () => {
    const m = await load();
    const id = await m.start();
    await m.sign(m.a.id, m.a.price, "cm-s3");
    await m.saveTwoWheel(wheel({ plusUnit: 2_000, ...only("ADD", 3) }));
    const plus = await m.playGame({ game: "TWO_WHEEL", broadcastId: id, requestId: key(1), memberId: "cm-s3", sourceId: null });
    expect(plus).toMatchObject({ status: "PLAYED", run: { label: "+3", kind: "ADD", value: 6_000, points: 6_000, wheel: { op: "ADD", n: 3 } } });

    await m.saveTwoWheel(wheel({ ...only("MULTIPLY", 4) }));
    const source = (await m.getGamesView())!.live!.sources.TWO_WHEEL["cm-s3"][0];
    const times = await m.playGame({ game: "TWO_WHEEL", broadcastId: id, requestId: key(2), memberId: "cm-s3", sourceId: source.id });
    expect(times).toMatchObject({ status: "PLAYED", run: { label: "×4", kind: "MULTIPLY", value: 4, points: m.a.price * 3, wheel: { op: "MULTIPLY", n: 4 } } });
    // Queued after the first run on ?twowheel (4 s + 4 s).
    expect(times.status === "PLAYED" && times.run.showAt).toBe(at(12).toISOString());

    vi.setSystemTime(at(16));
    expect((await m.getBroadcastView())!.live!.rows.find((r) => r.memberId === "cm-s3")).toMatchObject({ game: 6_000 + m.a.price * 3 });
  });

  it("plays every game with 자동 on once per 시그니처 후원, each on its own OBS queue", async () => {
    const m = await load();
    const id = await m.start();
    await m.saveSpinMachine({ ...DEFAULT_SPIN, auto: true, items: [{ id: "x", label: "+500", kind: "ADD", value: 500, weight: 1 }] });
    await m.saveDiceGame(dice({ auto: true }));
    await m.saveTwoWheel(wheel({ auto: true, excluded: [m.b.id], plusUnit: 1_000, ...only("ADD", 1) }));

    await m.sign(m.a.id, m.a.price, "cm-s2");
    expect(m.runs(id).map((r) => [r.game, r.id.split("-")[0], r.showAt])).toEqual([
      ["SPIN", "spin", at(4).toISOString()],
      ["DICE", "dice", at(4).toISOString()],
      ["TWO_WHEEL", "twowheel", at(4).toISOString()]
    ]);
    // An excluded signature skips only that game.
    await m.sign(m.b.id, m.b.price, "cm-s2");
    expect(m.runs(id).map((r) => r.game)).toEqual(["SPIN", "DICE", "TWO_WHEEL", "SPIN", "DICE"]);

    vi.setSystemTime(at(30));
    const rolled = m.runs(id).filter((r) => r.game === "DICE");
    const diceExtra = rolled.reduce((s, r) => s + r.points, 0);
    expect(rolled.map((r) => r.basePoints)).toEqual([m.a.price, m.b.price]);
    expect((await m.getBroadcastView())!.live!.rows.find((r) => r.memberId === "cm-s2")).toMatchObject({ game: 500 * 2 + 1_000 + diceExtra });
  });
});
