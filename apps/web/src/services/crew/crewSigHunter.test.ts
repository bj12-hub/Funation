import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import { DEFAULT_SIG_HUNTER, sigHunterColumns, type SigHunterRound, type SigHunterSettings } from "./crewTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 시그니처 헌터 (2026-10-24, StreamDonate 시그니처 헌터 참고) on the 점수 게임 engine. */
async function load() {
  const bc = await import("./crewBroadcast");
  const games = await import("./crewGames");
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
  const all = (await signatures.listSignatures())!;
  const [a, b] = all;
  let n = 0;
  const sign = (signatureId: string, price: number, memberId?: string) =>
    requestDonation({ creatorId: "studio", hideProfile: false, type: "SIGNATURE", signatureId, message: "", amount: price, expectedAmount: price, idempotencyKey: key(++n), memberId });
  // The seed attributions are stamped when the store is made (T0): the broadcast starts a second later.
  const start = async () => {
    vi.setSystemTime(at(1));
    expect(await bc.startBroadcast({ requestId: crypto.randomUUID(), title: "헌터 방송", teamMode: false })).toEqual({ status: "SAVED" });
    return (await bc.getBroadcastView())!.live!.id;
  };
  const view = async () => (await games.getGamesView())!.live!.sigHunter;
  const obs = async () => {
    const overlay = await bc.getOverlayScoreboard(mockCreator.integrationKey);
    if (overlay === "IDLE" || overlay === "FORBIDDEN") throw new Error("no live overlay");
    return overlay.sigHunter;
  };
  const stored = (id: string) => mockCrew.broadcasts!.find((x) => x.id === id)!;
  const runs = (id: string) => (stored(id).gameRuns ?? []).filter((r) => r.game === "SIG_HUNTER");
  const gamePoints = async (memberId: string) => (await bc.getBroadcastView())!.live!.rows.find((r) => r.memberId === memberId)!.game;
  return { ...bc, ...games, all, a, b, sign, start, view, obs, stored, runs, gamePoints };
}

const T0 = new Date("2026-10-24T12:00:00Z");
const at = (sec: number) => new Date(T0.getTime() + sec * 1000);
const round = (r: Partial<SigHunterRound> = {}): SigHunterRound => ({ id: "new-1", slots: 3, priceMin: null, priceMax: null, multiplier: 1, forfeits: 0, ...r });
const settings = (patch: Partial<Omit<SigHunterSettings, "rounds">> & { rounds?: unknown[] } = {}) => ({ ...DEFAULT_SIG_HUNTER, auto: true, ...patch });
/** A 라운드 of signature `s` only: every slot is it, sold in reading order. */
const only = (s: { price: number }, r: Partial<SigHunterRound> = {}) => round({ priceMin: s.price, priceMax: s.price, ...r });

describe("시그니처 헌터 판 모양", () => {
  it("fills whole rows where it can, never taller than wide", () => {
    const shape = (n: number) => `${sigHunterColumns(n)}×${Math.ceil(n / sigHunterColumns(n))}`;
    expect([1, 3, 4, 6, 8, 10, 12, 16, 20, 25, 30, 40].map(shape)).toEqual(["1×1", "3×1", "4×1", "3×2", "4×2", "5×2", "4×3", "4×4", "5×4", "5×5", "6×5", "8×5"]);
    expect([7, 13, 33, 37].map(shape)).toEqual(["4×2", "5×3", "6×6", "8×5"]);
  });
});

describe("시그니처 헌터", () => {
  beforeEach(() => {
    resetMockStores();
    vi.useFakeTimers({ now: T0, toFake: ["Date"] });
  });
  afterEach(() => vi.useRealTimers());

  it("validates and saves the settings", async () => {
    const m = await load();
    const rounds = [round({ slots: 10, priceMax: 10_000 }), round({ id: "new-2", slots: 40, priceMin: 10_000, multiplier: 1.5, forfeits: 2 })];
    expect(await m.saveSigHunter(settings({ rounds, excluded: [m.b.id] }))).toEqual({ status: "SAVED" });
    const saved = (await m.getGamesView())!.sigHunterSettings;
    expect(saved.rounds.map((r) => [r.slots, r.priceMin, r.priceMax, r.multiplier, r.forfeits])).toEqual([
      [10, null, 10_000, 1, 0],
      [40, 10_000, null, 1.5, 2]
    ]);
    // New 라운드 get a server id; a saved id is kept.
    expect(saved.rounds.every((r) => r.id.startsWith("hr-"))).toBe(true);
    expect(await m.saveSigHunter({ ...saved, rounds: saved.rounds.slice(1) })).toEqual({ status: "SAVED" });
    expect((await m.getGamesView())!.sigHunterSettings.rounds.map((r) => r.id)).toEqual([saved.rounds[1].id]);

    const bad: [Record<string, unknown>, string][] = [
      [{ rounds: [] }, "라운드는 1 ~ 6개"],
      [{ rounds: Array.from({ length: 7 }, () => round()) }, "라운드는 1 ~ 6개"],
      [{ rounds: [round({ slots: 0 })] }, "1라운드 슬롯은 1 ~ 40칸"],
      [{ rounds: [round(), round({ slots: 41 })] }, "2라운드 슬롯은 1 ~ 40칸"],
      [{ rounds: [round({ priceMin: -1 })] }, "금액 범위를 확인"],
      [{ rounds: [round({ priceMin: 10, priceMax: 5 })] }, "최소가 최대보다"],
      [{ rounds: [round({ multiplier: 0.5 })] }, "배수는 1 ~ 10배"],
      [{ rounds: [round({ multiplier: 11 })] }, "배수는 1 ~ 10배"],
      [{ rounds: [round({ multiplier: 1.234 })] }, "배수는 1 ~ 10배"],
      [{ rounds: [round({ forfeits: 3 })] }, "몰수권은 슬롯보다 적게, 0 ~ 2개"],
      [{ rounds: [round({ forfeits: -1 })] }, "몰수권은"],
      [{ excluded: ["sig-nope"] }, "제외할 시그니처"]
    ];
    for (const [patch, message] of bad) {
      const res = await m.saveSigHunter(settings(patch as Partial<SigHunterSettings>));
      expect(res.status === "INVALID" && res.message, message).toContain(message);
    }
    signIn(["SUPPORTER"]);
    expect(await m.saveSigHunter(settings())).toEqual({ status: "UNAUTHORIZED" });
  });

  it("추가 금액 구간: each fills its own slots from its own range, all placed at random", async () => {
    const m = await load();
    const id = await m.start();
    const [x, y] = [m.a, m.b];
    const bands = [{ slots: 3, priceMin: y.price, priceMax: y.price }];
    expect(await m.saveSigHunter(settings({ rounds: [only(x, { slots: 2, forfeits: 4, bands })] }))).toEqual({ status: "SAVED" });
    const saved = (await m.getGamesView())!.sigHunterSettings.rounds[0];
    expect(saved.bands).toEqual(bands);
    expect(await m.startSigHunter({ broadcastId: id, requestId: key(1) })).toEqual({ status: "SAVED" });
    const slots = (await m.view()).board!.slots;
    expect(slots).toHaveLength(5);
    expect(slots.filter((s) => s.signatureId === x.id)).toHaveLength(2);
    expect(slots.filter((s) => s.signatureId === y.id)).toHaveLength(3);
    expect(slots.filter((s) => s.forfeit)).toHaveLength(4); // 몰수권: fewer than all the slots, 구간 included

    // A 라운드 without 추가 구간 keeps none; an empty 구간 list saves as none.
    expect(await m.saveSigHunter(settings({ rounds: [round({ bands: [] })] }))).toEqual({ status: "SAVED" });
    expect((await m.getGamesView())!.sigHunterSettings.rounds[0]).not.toHaveProperty("bands");

    // A 구간 without a signature stops the hunt like a 라운드 without one.
    await m.saveSigHunter(settings({ rounds: [round({ bands: [{ slots: 1, priceMin: 9_000_000, priceMax: null }] })] }));
    expect(await m.startSigHunter({ broadcastId: id, requestId: key(2) })).toEqual({ status: "INVALID", message: "1라운드에 넣을 시그니처가 없어요. 금액 범위와 제외 시그를 확인해 주세요." });

    const band = (b: Record<string, unknown>) => ({ slots: 1, priceMin: null, priceMax: null, ...b });
    const bad: [Record<string, unknown>, string][] = [
      [{ bands: "1" }, "추가 금액 구간은 4개까지"],
      [{ bands: Array.from({ length: 5 }, () => band({})) }, "추가 금액 구간은 4개까지"],
      [{ bands: [band({}), band({ slots: 0 })] }, "1라운드 추가 구간 2의 슬롯은 1칸 이상"],
      [{ bands: [band({ priceMin: -5 })] }, "추가 구간 1의 금액 범위를 확인"],
      [{ bands: [band({ priceMin: 10, priceMax: 5 })] }, "최소가 최대보다"],
      [{ slots: 30, bands: [band({ slots: 11 })] }, "추가 금액 구간까지 모두 40칸까지"],
      [{ slots: 3, forfeits: 5, bands: [band({ slots: 2 })] }, "몰수권은 슬롯보다 적게, 0 ~ 4개"]
    ];
    for (const [patch, message] of bad) {
      const res = await m.saveSigHunter(settings({ rounds: [round(patch as Partial<SigHunterRound>)] }));
      expect(res.status === "INVALID" && res.message, message).toContain(message);
    }
  });

  it("places 1라운드 signatures in random slots with its 몰수권 hidden from OBS", async () => {
    const m = await load();
    expect(await m.startSigHunter({ broadcastId: "bc-x", requestId: key(1) })).toEqual({ status: "INVALID", message: "진행 중인 방송이 아니에요." });
    const id = await m.start();
    await m.saveSigHunter(settings({ rounds: [round({ slots: 12, forfeits: 2, multiplier: 2 })], excluded: [m.b.id] }));
    expect((await m.view()).board).toBeNull();
    expect(await m.startSigHunter({ broadcastId: id, requestId: key(1) })).toEqual({ status: "SAVED" });
    const board = (await m.view()).board!;
    expect(board).toMatchObject({ round: 1, multiplier: 2, lastSold: null, advanceAt: null });
    expect(board.slots).toHaveLength(12);
    // 7 signatures for 12 slots: each at least once, the excluded one never.
    const ids = board.slots.map((x) => x.signatureId);
    for (const s of m.all.filter((x) => x.id !== m.b.id)) expect(ids).toContain(s.id);
    expect(ids).not.toContain(m.b.id);
    expect(board.slots.filter((x) => x.forfeit)).toHaveLength(2);
    expect(board.slots[0]).toMatchObject({ price: expect.any(Number), imageUrl: expect.any(String), sold: null });
    expect((await m.obs()).board!.slots.some((x) => x.forfeit)).toBe(false);

    expect(await m.startSigHunter({ broadcastId: id, requestId: key(1) })).toEqual({ status: "SAVED" }); // retried: same hunt
    expect((await m.view()).board!.slots).toEqual(board.slots);
    expect(await m.saveSigHunter(settings({ rounds: [round({ priceMin: 9_000_000 })] }))).toEqual({ status: "SAVED" });
    expect(await m.startSigHunter({ broadcastId: id, requestId: key(2) })).toEqual({ status: "INVALID", message: "1라운드에 넣을 시그니처가 없어요. 금액 범위와 제외 시그를 확인해 주세요." });
    expect(await m.playGame({ game: "SIG_HUNTER", broadcastId: id, requestId: key(3), memberId: "cm-s2" })).toEqual({
      status: "INVALID",
      message: "시그니처 헌터는 시그니처 후원이나 슬롯 누르기로 SOLD OUT 돼요."
    });
    expect(await m.clearSigHunter({ broadcastId: id })).toEqual({ status: "SAVED" });
    expect((await m.view()).board).toBeNull();
    signIn(["SUPPORTER"]);
    expect(await m.startSigHunter({ broadcastId: id, requestId: key(4) })).toEqual({ status: "UNAUTHORIZED" });
  });

  it("a 시그니처 후원 sells its slot × the 라운드 배수; a sold-out 라운드 moves on after its last result, the last one repeating", async () => {
    const m = await load();
    const id = await m.start();
    await m.saveSigHunter(settings({ rounds: [only(m.a, { multiplier: 2 }), only(m.b, { id: "new-2", slots: 1 })] }));
    await m.startSigHunter({ broadcastId: id, requestId: key(1) });
    await m.sign(m.a.id, m.a.price, "cm-s2");
    await m.sign(m.b.id, m.b.price, "cm-s2"); // not on this 라운드
    await m.sign(m.a.id, m.a.price); // no member: SOLD OUT, no 기여도
    expect(m.runs(id).map((r) => [r.memberId, r.label, r.kind, r.value, r.basePoints, r.points])).toEqual([
      ["cm-s2", `${m.a.name} SOLD OUT`, "MULTIPLY", 2, m.a.price, m.a.price],
      ["", `${m.a.name} SOLD OUT`, "TEXT", 0, m.a.price, 0]
    ]);
    let board = (await m.view()).board!;
    expect(board.slots.map((x) => x.sold && [x.sold.memberName, x.sold.points, x.sold.manual])).toEqual([["하늘", m.a.price * 2, false], [null, 0, false], null]);
    expect(board.lastSold).toBe(1);
    expect(await m.gamePoints("cm-s2")).toBe(0);
    vi.setSystemTime(at(60));
    expect(await m.gamePoints("cm-s2")).toBe(m.a.price);

    await m.sign(m.a.id, m.a.price, "cm-s3"); // the last slot
    board = (await m.view()).board!;
    const last = m.runs(id).at(-1)!;
    expect(board).toMatchObject({ round: 1, advanceAt: new Date(Date.parse(last.revealAt) + 4_000).toISOString() });
    vi.setSystemTime(Date.parse(board.advanceAt!) - 1);
    expect((await m.obs()).board!.round).toBe(1);
    vi.setSystemTime(Date.parse(board.advanceAt!));
    board = (await m.obs()).board!;
    expect(board).toMatchObject({ round: 2, multiplier: 1, advanceAt: null });
    expect(board.slots.map((x) => x.signatureId)).toEqual([m.b.id]);
    // 배수 1: SOLD OUT without points; the next sale for a sold-out 라운드 does not wait — 3라운드 repeats the last one.
    await m.sign(m.b.id, m.b.price, "cm-s2");
    expect(m.runs(id).at(-1)).toMatchObject({ kind: "TEXT", points: 0 });
    await m.sign(m.b.id, m.b.price, "cm-s2");
    expect((await m.view()).board).toMatchObject({ round: 3, slots: [{ signatureId: m.b.id, sold: { memberName: "하늘" } }] });

    // Off, or an excluded signature: nothing is sold.
    await m.startSigHunter({ broadcastId: id, requestId: key(2) });
    await m.saveSigHunter(settings({ rounds: [only(m.a)], auto: false }));
    await m.sign(m.a.id, m.a.price, "cm-s2");
    await m.saveSigHunter(settings({ rounds: [only(m.a)], excluded: [m.a.id] }));
    await m.sign(m.a.id, m.a.price, "cm-s2");
    expect((await m.view()).board!.slots.filter((x) => x.sold)).toHaveLength(0);
  });

  it("몰수권: its buyer takes the SOLD OUT 기여도 of the other members' slots", async () => {
    const m = await load();
    const id = await m.start();
    await m.saveSigHunter(settings({ rounds: [only(m.a, { slots: 6, multiplier: 2, forfeits: 1 })] }));
    await m.startSigHunter({ broadcastId: id, requestId: key(1) });
    // Put the 몰수권 in slot 3 and in slot 5 (slots sell in reading order).
    m.stored(id).sigHunter!.slots.forEach((x, i) => (x.forfeit = i === 3 || i === 5));
    const p = m.a.price;
    await m.sign(m.a.id, p, "cm-s2");
    await m.sign(m.a.id, p, "cm-s1");
    await m.sign(m.a.id, p, "cm-s3");
    await m.sign(m.a.id, p, "cm-s1"); // the 몰수권: takes 하늘's and 바다's, not 길동's own
    expect(m.runs(id).at(-1)).toMatchObject({
      memberId: "cm-s1",
      label: "몰수권! 2칸 흡수",
      kind: "ADD",
      points: p + 4 * p,
      shares: [
        { memberId: "cm-s2", points: -2 * p },
        { memberId: "cm-s3", points: -2 * p }
      ]
    });
    let view = await m.view();
    expect(view.board!.slots.slice(0, 4).map((x) => x.sold!.absorbedBy)).toEqual(["길동", null, "길동", null]);
    expect(view.runs[0].shares).toEqual([
      { memberName: "하늘", memberColor: expect.any(String), points: -2 * p },
      { memberName: "바다", memberColor: expect.any(String), points: -2 * p }
    ]);
    // OBS learns of a 몰수권 once it is sold.
    expect((await m.obs()).board!.slots.map((x) => x.forfeit)).toEqual([false, false, false, true, false, false]);

    await m.sign(m.a.id, p, "cm-s2");
    await m.sign(m.a.id, p); // the second 몰수권 without a member takes nothing
    expect(m.runs(id).at(-1)).toMatchObject({ memberId: "", label: "몰수권 (멤버 없음)", points: 0 });
    vi.setSystemTime(at(300));
    // 길동: 배수 part of two sales + what the 몰수권 took; 하늘 · 바다 lose the 기여도 of their taken slots.
    expect(await m.gamePoints("cm-s1")).toBe(p + p + 4 * p);
    expect(await m.gamePoints("cm-s2")).toBe(p - 2 * p + p);
    expect(await m.gamePoints("cm-s3")).toBe(p - 2 * p);
    const rows = (await m.getBroadcastView())!.live!.rows;
    expect(["cm-s1", "cm-s2", "cm-s3"].map((x) => rows.find((r) => r.memberId === x)!.score)).toEqual([8 * p, 2 * p, 0]);
    view = await m.view();
    expect(view.board!.round).toBe(2);
  });

  it("lets the operator sell, restore and move to the next 라운드", async () => {
    const m = await load();
    const id = await m.start();
    const set = (requestId: string, index: unknown, sold: unknown, memberId: string | null = null, r: unknown = 1) => m.setSigHunter({ broadcastId: id, requestId, index, round: r, sold, memberId });
    expect(await set(key(1), 0, true)).toEqual({ status: "INVALID", message: "헌트를 먼저 시작해 주세요." });
    await m.saveSigHunter(settings({ rounds: [only(m.a, { slots: 4, multiplier: 3, forfeits: 1 }), only(m.b, { id: "new-2" })] }));
    await m.startSigHunter({ broadcastId: id, requestId: key(1) });
    m.stored(id).sigHunter!.slots.forEach((x, i) => (x.forfeit = i === 3));
    expect(await set(key(2), 0, true, "cm-s1")).toEqual({ status: "SAVED" });
    expect(await set(key(2), 0, true, "cm-s1")).toEqual({ status: "SAVED" }); // retried: nothing more
    expect(m.runs(id).map((r) => [r.memberId, r.label, r.points, r.trigger])).toEqual([["cm-s1", `${m.a.name} SOLD OUT`, 0, { kind: "MANUAL" }]]);
    expect((await m.view()).board!.slots[0].sold).toMatchObject({ memberName: "길동", manual: true, points: 0 });
    expect(await set(key(3), 0, false)).toEqual({ status: "SAVED" }); // 되돌리기
    expect((await m.view()).board!.slots[0].sold).toBeNull();
    await m.sign(m.a.id, m.a.price, "cm-s2"); // slot 0 by donation
    expect(await set(key(4), 0, false)).toEqual({ status: "INVALID", message: "후원으로 SOLD OUT된 슬롯은 되돌릴 수 없어요." });
    expect(await set(key(5), 3, true, "cm-s3")).toEqual({ status: "SAVED" }); // 수동 몰수권 takes 하늘's slot
    expect(m.runs(id).at(-1)).toMatchObject({ memberId: "cm-s3", label: "몰수권! 1칸 흡수", points: m.a.price * 3, shares: [{ memberId: "cm-s2", points: -m.a.price * 3 }] });
    expect(await set(key(6), 3, false)).toEqual({ status: "INVALID", message: "몰수권 슬롯은 되돌릴 수 없어요." });
    expect(await set(key(7), 0, false)).toEqual({ status: "INVALID", message: "몰수된 슬롯은 되돌릴 수 없어요." });
    expect(await set(key(8), 1, true, null, 2)).toEqual({ status: "INVALID", message: "라운드가 바뀌었어요. 슬롯을 다시 골라 주세요." });
    for (const bad of [4, -1, 1.5, "0"]) expect(await set(key(9), bad, true)).toEqual({ status: "INVALID", message: "슬롯을 다시 골라 주세요." });
    expect(await set(key(9), 1, "yes")).toEqual({ status: "INVALID", message: "슬롯을 다시 골라 주세요." });

    expect(await m.nextSigHunter({ broadcastId: id, round: 1 })).toEqual({ status: "SAVED" });
    expect((await m.view()).board).toMatchObject({ round: 2, multiplier: 1 });
    expect(await m.nextSigHunter({ broadcastId: id, round: 1 })).toEqual({ status: "SAVED" }); // retried: still 2라운드
    expect((await m.view()).board!.round).toBe(2);
    await m.saveSigHunter(settings({ rounds: [only(m.a), round({ id: "new-2", priceMin: 9_000_000 })] }));
    expect(await m.nextSigHunter({ broadcastId: id, round: 2 })).toEqual({ status: "INVALID", message: "3라운드에 넣을 시그니처가 없어요. 금액 범위와 제외 시그를 확인해 주세요." });
    expect((await m.view()).board!.round).toBe(2);
    signIn(["SUPPORTER"]);
    expect(await set(key(10), 0, true)).toEqual({ status: "UNAUTHORIZED" });
  });
});
