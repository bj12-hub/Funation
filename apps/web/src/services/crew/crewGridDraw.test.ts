import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import { DEFAULT_GRID_DRAW, type GridDrawSettings, type GridPrize } from "./crewTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 복불복 뽑기판 (2026-10-24, StreamDonate 복불복 뽑기판 참고) on the 점수 게임 engine. */
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
  mockAccount.fnBalance = 1_000_000;
  const all = (await signatures.listSignatures())!;
  const [a, b] = all;
  let n = 0;
  const sign = (signatureId: string, price: number, memberId?: string) =>
    requestDonation({ creatorId: "studio", hideProfile: false, type: "SIGNATURE", signatureId, message: "", amount: price, expectedAmount: price, idempotencyKey: key(++n), memberId });
  const text = (amount: number, memberId?: string) =>
    requestDonation({ creatorId: "studio", hideProfile: false, type: "TEXT", amount, message: "뽑기!", voiceId: null, idempotencyKey: key(++n), memberId });
  // The seed attributions are stamped when the store is made (T0): the broadcast starts a second later.
  const start = async () => {
    vi.setSystemTime(at(1));
    expect(await bc.startBroadcast({ requestId: crypto.randomUUID(), title: "뽑기 방송", teamMode: false })).toEqual({ status: "SAVED" });
    return (await bc.getBroadcastView())!.live!.id;
  };
  const view = async () => (await games.getGamesView())!.live!.gridDraw;
  const obs = async () => {
    const overlay = await bc.getOverlayScoreboard(mockCreator.integrationKey);
    if (overlay === "IDLE" || overlay === "FORBIDDEN") throw new Error("no live overlay");
    return overlay.gridDraw;
  };
  const runs = (id: string) => (mockCrew.broadcasts!.find((x) => x.id === id)!.gameRuns ?? []).filter((r) => r.game === "GRID_DRAW");
  const opened = async () => (await view()).board!.cells.filter((c) => c.opened).length;
  const gamePoints = async (memberId: string) => (await bc.getBroadcastView())!.live!.rows.find((r) => r.memberId === memberId)!.game;
  return { ...bc, ...games, all, a, b, sign, text, start, view, obs, runs, opened, gamePoints };
}

const T0 = new Date("2026-10-24T12:00:00Z");
const at = (sec: number) => new Date(T0.getTime() + sec * 1000);
const prize = (p: Partial<GridPrize>) => ({ id: "new-1", kind: "TEXT", label: "애교", signatureId: null, points: 0, count: 1, ...p });
const settings = (patch: Partial<Omit<GridDrawSettings, "prizes">> & { prizes?: unknown[] } = {}) => ({ ...DEFAULT_GRID_DRAW, auto: true, size: 3, ...patch });
/** A 3×3 board of 점수 prizes only: every opening is worth `points`. */
const allPoints = (points: number) => settings({ prizes: [prize({ kind: "POINTS", label: "보너스", points, count: 9 })] });

describe("복불복 뽑기판", () => {
  beforeEach(() => {
    resetMockStores();
    vi.useFakeTimers({ now: T0, toFake: ["Date"] });
  });
  afterEach(() => vi.useRealTimers());

  it("validates and saves the settings", async () => {
    const m = await load();
    const prizes = [prize({ label: " 애교 3종 ", count: 2 }), prize({ id: "new-2", kind: "SIGNATURE", label: "", signatureId: m.a.id }), prize({ id: "new-3", kind: "POINTS", label: "보너스", points: 3_000 })];
    expect(await m.saveGridDraw(settings({ trigger: "ANY", minAmount: 1_000, autoReset: false, prizes }))).toEqual({ status: "SAVED" });
    const saved = (await m.getGamesView())!.gridDrawSettings;
    expect(saved).toMatchObject({ size: 3, trigger: "ANY", minAmount: 1_000, autoReset: false });
    expect(saved.prizes.map((p) => [p.kind, p.label, p.signatureId, p.points, p.count])).toEqual([
      ["TEXT", "애교 3종", null, 0, 2],
      ["SIGNATURE", m.a.name, m.a.id, 0, 1],
      ["POINTS", "보너스", null, 3_000, 1]
    ]);
    // New prizes get a server id; a saved id is kept.
    expect(saved.prizes.every((p) => p.id.startsWith("gp-"))).toBe(true);
    expect(await m.saveGridDraw({ ...saved, prizes: saved.prizes.slice(1) })).toEqual({ status: "SAVED" });
    expect((await m.getGamesView())!.gridDrawSettings.prizes.map((p) => p.id)).toEqual(saved.prizes.slice(1).map((p) => p.id));

    const bad: [Record<string, unknown>, string][] = [
      [{ size: 7 }, "칸 개수"],
      [{ trigger: "BIG" }, "설정"],
      [{ autoReset: "yes" }, "설정"],
      [{ minAmount: -1 }, "최소 금액"],
      [{ minAmount: 1.5 }, "최소 금액"],
      [{ prizes: Array.from({ length: 21 }, () => prize({})) }, "20개까지"],
      [{ prizes: [prize({ kind: "BOX" as never })] }, "당첨 종류"],
      [{ prizes: [prize({ count: 0 })] }, "1 ~ 9칸"],
      [{ prizes: [prize({ count: 10 })] }, "1 ~ 9칸"],
      [{ prizes: [prize({ label: " " })] }, "당첨 문구"],
      [{ prizes: [prize({ label: "가".repeat(21) })] }, "당첨 문구"],
      [{ prizes: [prize({ label: "운영자 호출" })] }, "사용할 수 없는 단어"],
      [{ prizes: [prize({ kind: "SIGNATURE", signatureId: "sig-nope" })] }, "당첨 시그니처"],
      [{ prizes: [prize({ kind: "POINTS", points: 0 })] }, "점수는"],
      [{ prizes: [prize({ count: 5 }), prize({ id: "new-2", count: 5 })] }, "당첨 칸(10칸)이 전체 칸(9칸)보다 많아요."],
      [{ excluded: ["sig-nope"] }, "제외할 시그니처"]
    ];
    for (const [patch, message] of bad) {
      const res = await m.saveGridDraw(settings(patch as Partial<GridDrawSettings>));
      expect(res.status === "INVALID" && res.message, message).toContain(message);
    }
    signIn(["SUPPORTER"]);
    expect(await m.saveGridDraw(settings())).toEqual({ status: "UNAUTHORIZED" });
  });

  it("hides each prize in its cells and 꽝 in the rest; OBS gets closed cells without their prize", async () => {
    const m = await load();
    expect(await m.startGridDraw({ broadcastId: "bc-x", requestId: key(1) })).toEqual({ status: "INVALID", message: "진행 중인 방송이 아니에요." });
    const id = await m.start();
    await m.saveGridDraw(settings({ prizes: [prize({ count: 2 }), prize({ id: "new-2", kind: "SIGNATURE", signatureId: m.a.id }), prize({ id: "new-3", kind: "POINTS", label: "보너스", points: 500 })] }));
    expect((await m.view()).board).toBeNull();
    expect(await m.startGridDraw({ broadcastId: id, requestId: key(1) })).toEqual({ status: "SAVED" });
    const board = (await m.view()).board!;
    expect(board).toMatchObject({ size: 3, round: 1, lastOpened: null, resetAt: null });
    const kinds = board.cells.map((c) => c.kind).sort();
    expect(kinds).toEqual(["MISS", "MISS", "MISS", "MISS", "MISS", "POINTS", "SIGNATURE", "TEXT", "TEXT"]);
    expect(board.cells.find((c) => c.kind === "SIGNATURE")).toMatchObject({ label: m.a.name, imageUrl: expect.any(String) });
    expect(board.cells.find((c) => c.kind === "MISS")).toMatchObject({ label: "꽝", imageUrl: null });
    expect((await m.obs()).board!.cells.every((c) => c.kind === "HIDDEN" && c.label === "" && c.imageUrl === null && c.points === 0)).toBe(true);
    expect((await m.obs()).settings.prizes).toEqual([]);
    expect((await m.view()).settings.prizes).toHaveLength(3);

    expect(await m.startGridDraw({ broadcastId: id, requestId: key(1) })).toEqual({ status: "SAVED" }); // retried: same board
    expect((await m.view()).board!.cells).toEqual(board.cells);
    expect(await m.playGame({ game: "GRID_DRAW", broadcastId: id, requestId: key(2), memberId: "cm-s2" })).toEqual({ status: "INVALID", message: "뽑기판은 후원이나 칸 누르기로 열어요." });
    expect(await m.clearGridDraw({ broadcastId: id })).toEqual({ status: "SAVED" });
    expect((await m.view()).board).toBeNull();
    signIn(["SUPPORTER"]);
    expect(await m.startGridDraw({ broadcastId: id, requestId: key(3) })).toEqual({ status: "UNAUTHORIZED" });
  });

  it("a donation opens a random closed cell: 시그니처 후원만 or 모든 후원, from the 최소 금액, not for 제외 시그", async () => {
    const m = await load();
    const id = await m.start();
    await m.saveGridDraw({ ...allPoints(1_000), minAmount: m.a.price, excluded: [m.b.id] });
    await m.startGridDraw({ broadcastId: id, requestId: key(1) });
    await m.text(Math.max(m.a.price, 1_000), "cm-s2"); // 시그니처 후원만: a text donation opens nothing
    await m.sign(m.b.id, m.b.price, "cm-s2"); // 제외 시그
    expect(await m.opened()).toBe(0);
    await m.sign(m.a.id, m.a.price, "cm-s2");
    await m.sign(m.a.id, m.a.price); // no member: the cell opens, no points
    expect(m.runs(id).map((r) => [r.memberId, r.label, r.kind, r.points, r.trigger.kind])).toEqual([
      ["cm-s2", "보너스", "ADD", 1_000, "SIGNATURE"],
      ["", "보너스", "TEXT", 0, "SIGNATURE"]
    ]);
    let board = (await m.view()).board!;
    expect(board.cells.filter((c) => c.opened).map((c) => [c.opened!.memberName, c.opened!.manual])).toEqual(
      expect.arrayContaining([
        ["하늘", false],
        [null, false]
      ])
    );
    // The opened cells show on OBS with their prize; the points count once the result shows.
    expect((await m.obs()).board!.cells.filter((c) => c.kind === "POINTS")).toHaveLength(2);
    expect(await m.gamePoints("cm-s2")).toBe(0);
    vi.setSystemTime(at(60));
    expect(await m.gamePoints("cm-s2")).toBe(1_000);

    // 모든 후원: a text donation of the 최소 금액 or more opens a cell too.
    await m.saveGridDraw({ ...allPoints(1_000), trigger: "ANY", minAmount: 2_000 });
    await m.text(1_000, "cm-s3"); // under the 최소 금액
    expect(await m.opened()).toBe(2);
    await m.text(2_000, "cm-s3");
    expect(m.runs(id).at(-1)).toMatchObject({ memberId: "cm-s3", points: 1_000, trigger: { kind: "DONATION", amount: 2_000 } });
    // Off: donations open nothing.
    await m.saveGridDraw({ ...allPoints(1_000), trigger: "ANY", auto: false });
    await m.text(2_000, "cm-s3");
    board = (await m.view()).board!;
    expect(board.cells.filter((c) => c.opened)).toHaveLength(3);
  });

  it("lets the operator open a picked or a random cell, once per request", async () => {
    const m = await load();
    const id = await m.start();
    const open = (requestId: string, index: unknown, memberId: string | null = null, round: unknown = 1) => m.openGridDraw({ broadcastId: id, requestId, index, round, memberId });
    expect(await open(key(1), 0)).toEqual({ status: "INVALID", message: "뽑기판을 먼저 시작해 주세요." });
    await m.saveGridDraw(allPoints(700));
    await m.startGridDraw({ broadcastId: id, requestId: key(1) });
    expect(await open(key(2), 4, "cm-s1")).toEqual({ status: "SAVED" });
    expect(await open(key(2), 4, "cm-s1")).toEqual({ status: "SAVED" }); // retried: nothing more
    expect(m.runs(id).map((r) => [r.memberId, r.points, r.trigger])).toEqual([["cm-s1", 700, { kind: "MANUAL" }]]);
    expect((await m.view()).board).toMatchObject({ lastOpened: 4 });
    expect((await m.view()).board!.cells[4].opened).toMatchObject({ memberName: "길동", memberColor: expect.any(String), manual: true });
    expect(await open(key(3), 4)).toEqual({ status: "INVALID", message: "이미 열린 칸이에요." });
    expect(await open(key(4), 3, null, 2)).toEqual({ status: "INVALID", message: "판이 바뀌었어요. 칸을 다시 골라 주세요." });
    for (const bad of [9, -1, 1.5, "0"]) expect(await open(key(5), bad)).toEqual({ status: "INVALID", message: "칸을 다시 골라 주세요." });
    // Random, for a member who is not on the crew: the cell opens without points.
    expect(await open(key(6), null, "cm-nope")).toEqual({ status: "SAVED" });
    expect(await open(key(6), null, "cm-nope")).toEqual({ status: "SAVED" });
    expect(m.runs(id).map((r) => [r.memberId, r.points])).toEqual([
      ["cm-s1", 700],
      ["", 0]
    ]);
    expect(await m.opened()).toBe(2);
    signIn(["SUPPORTER"]);
    expect(await open(key(7), null)).toEqual({ status: "UNAUTHORIZED" });
  });

  it("자동 리셋: a full board stays until its last result has played, then the next board replaces it", async () => {
    const m = await load();
    const id = await m.start();
    await m.saveGridDraw(allPoints(100));
    await m.startGridDraw({ broadcastId: id, requestId: key(1) });
    for (let i = 0; i < 9; i++) expect(await m.openGridDraw({ broadcastId: id, requestId: key(10 + i), index: null, round: 1, memberId: "cm-s2" })).toEqual({ status: "SAVED" });
    const full = (await m.view()).board!;
    const last = m.runs(id).at(-1)!;
    expect(full).toMatchObject({ round: 1, resetAt: new Date(Date.parse(last.revealAt) + 4_000).toISOString() });
    expect(full.cells.every((c) => c.opened)).toBe(true);
    expect(await m.openGridDraw({ broadcastId: id, requestId: key(20), index: 0, round: 1, memberId: null })).toEqual({ status: "INVALID", message: "이미 열린 칸이에요." });

    vi.setSystemTime(Date.parse(full.resetAt!) - 1);
    expect((await m.obs()).board!.round).toBe(1);
    vi.setSystemTime(Date.parse(full.resetAt!));
    expect((await m.obs()).board).toMatchObject({ round: 2, lastOpened: null, resetAt: null });
    expect((await m.view()).board!.cells.every((c) => !c.opened)).toBe(true);
    expect(await m.startGridDraw({ broadcastId: id, requestId: key(1) })).toEqual({ status: "SAVED" }); // the start retried: still round 2
    expect((await m.view()).board!.round).toBe(2);

    // An opening on a full board does not wait for the reset.
    for (let i = 0; i < 9; i++) await m.openGridDraw({ broadcastId: id, requestId: key(30 + i), index: null, round: 2, memberId: null });
    expect((await m.view()).board).toMatchObject({ round: 2, resetAt: expect.any(String) });
    await m.sign(m.a.id, m.a.price, "cm-s3");
    expect((await m.view()).board).toMatchObject({ round: 3, resetAt: null });
    expect(await m.opened()).toBe(1);

    // 자동 리셋 off: the full board stays; nothing is left to open.
    await m.saveGridDraw({ ...allPoints(100), autoReset: false });
    await m.startGridDraw({ broadcastId: id, requestId: key(2) });
    for (let i = 0; i < 9; i++) await m.openGridDraw({ broadcastId: id, requestId: key(40 + i), index: null, round: 1, memberId: null });
    vi.setSystemTime(at(3_600));
    expect((await m.view()).board).toMatchObject({ round: 1, resetAt: null });
    expect(await m.openGridDraw({ broadcastId: id, requestId: key(50), index: null, round: 1, memberId: null })).toEqual({ status: "INVALID", message: "열 칸이 없어요. 새 판으로 다시 시작해 주세요." });
    const before = m.runs(id).length;
    await m.sign(m.a.id, m.a.price, "cm-s3");
    expect(m.runs(id)).toHaveLength(before);
  });
});
