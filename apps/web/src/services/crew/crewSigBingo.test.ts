import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import { DEFAULT_SIG_BINGO, sigBingoLineName, sigBingoLines, type SigBingoSettings } from "./crewTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 시그 빙고 (2026-10-24, StreamDonate 시그니처 빙고 참고) on the 점수 게임 engine. */
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
  // The seed attributions are stamped when the store is made (T0): the broadcast starts a second later.
  const start = async () => {
    vi.setSystemTime(at(1));
    expect(await bc.startBroadcast({ requestId: crypto.randomUUID(), title: "빙고 방송", teamMode: false })).toEqual({ status: "SAVED" });
    return (await bc.getBroadcastView())!.live!.id;
  };
  const view = async () => (await games.getGamesView())!.live!.sigBingo;
  const runs = (id: string) => (mockCrew.broadcasts!.find((x) => x.id === id)!.gameRuns ?? []).filter((r) => r.game === "SIG_BINGO");
  return { ...bc, ...games, all, a, b, sign, start, view, runs, overlayKey: mockCreator.integrationKey };
}

const T0 = new Date("2026-10-24T12:00:00Z");
const at = (sec: number) => new Date(T0.getTime() + sec * 1000);
const settings = (patch: Partial<SigBingoSettings> = {}) => ({ ...DEFAULT_SIG_BINGO, auto: true, ...patch });
/** Only signature `s` on the board: every cell is it, opened in reading order. */
const only = (s: { price: number }) => ({ priceMin: s.price, priceMax: s.price });

describe("시그 빙고 줄", () => {
  it("lists rows, columns and both diagonals", () => {
    expect(sigBingoLines(3)).toEqual([
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6]
    ]);
    expect(sigBingoLines(5)).toHaveLength(12);
    expect([0, 3, 6, 7].map((l) => sigBingoLineName(3, l))).toEqual(["가로 1줄", "세로 1줄", "대각선 ↘", "대각선 ↙"]);
  });
});

describe("시그 빙고", () => {
  beforeEach(() => {
    resetMockStores();
    vi.useFakeTimers({ now: T0, toFake: ["Date"] });
  });
  afterEach(() => vi.useRealTimers());

  it("validates and saves the settings", async () => {
    const m = await load();
    expect(await m.saveSigBingo(settings({ size: 5, mode: "TERRITORY", reveal: "HIDDEN", priceMin: 1_000, priceMax: null, bonus: 5_000 }))).toEqual({ status: "SAVED" });
    expect((await m.getGamesView())!.sigBingoSettings).toMatchObject({ size: 5, mode: "TERRITORY", reveal: "HIDDEN", priceMin: 1_000, priceMax: null, bonus: 5_000 });
    const bad: [Record<string, unknown>, string][] = [
      [{ size: 4 }, "판 크기"],
      [{ mode: "HOYEON" }, "설정"],
      [{ reveal: "HALF" }, "설정"],
      [{ priceMin: -1 }, "금액 범위"],
      [{ priceMin: 10, priceMax: 5 }, "최소가 최대보다"],
      [{ bonus: -1 }, "빙고 보너스"],
      [{ bonus: 1.5 }, "빙고 보너스"],
      [{ excluded: ["sig-nope"] }, "제외할 시그니처"]
    ];
    for (const [patch, message] of bad) {
      const res = await m.saveSigBingo(settings(patch as Partial<SigBingoSettings>));
      expect(res.status === "INVALID" && res.message, message).toContain(message);
    }
    signIn(["SUPPORTER"]);
    expect(await m.saveSigBingo(settings())).toEqual({ status: "UNAUTHORIZED" });
  });

  it("places the eligible signatures at random on a new board", async () => {
    const m = await load();
    expect(await m.startSigBingo({ broadcastId: "bc-x", requestId: key(1) })).toEqual({ status: "INVALID", message: "진행 중인 방송이 아니에요." });
    const id = await m.start();
    await m.saveSigBingo(settings({ excluded: [m.b.id] }));
    expect(await m.startSigBingo({ broadcastId: id, requestId: key(1) })).toEqual({ status: "SAVED" });
    const board = (await m.view()).board!;
    expect(board.grids[0].cells).toHaveLength(9);
    // 7 signatures for 9 cells: each one at least once, some twice; the excluded one never.
    const ids = board.grids[0].cells.map((c) => c.signatureId);
    for (const s of m.all.filter((x) => x.id !== m.b.id)) expect(ids).toContain(s.id);
    expect(ids).not.toContain(m.b.id);
    expect(await m.startSigBingo({ broadcastId: id, requestId: key(1) })).toEqual({ status: "SAVED" }); // retried: same board
    expect((await m.view()).board!.startedAt).toBe(board.startedAt);

    expect(await m.saveSigBingo(settings({ priceMin: 9_000_000 }))).toEqual({ status: "SAVED" });
    expect(await m.startSigBingo({ broadcastId: id, requestId: key(2) })).toEqual({ status: "INVALID", message: "빙고판에 넣을 시그니처가 없어요. 금액 범위와 제외 시그를 확인해 주세요." });
    expect((await m.view()).eligible).toBe(0);
    expect(await m.clearSigBingo({ broadcastId: id })).toEqual({ status: "SAVED" });
    expect((await m.view()).board).toBeNull();
    expect(await m.playGame({ game: "SIG_BINGO", broadcastId: id, requestId: key(3), memberId: "cm-s2" })).toEqual({ status: "INVALID", message: "시그 빙고는 시그니처 후원이나 칸 누르기로 열어요." });
  });

  it("공용 판: any 시그니처 후원 opens its cell; the donation completing a line gets the 빙고 보너스", async () => {
    const m = await load();
    const id = await m.start();
    await m.saveSigBingo(settings({ ...only(m.a), bonus: 1_000 }));
    await m.startSigBingo({ broadcastId: id, requestId: key(1) });
    await m.sign(m.a.id, m.a.price, "cm-s2");
    await m.sign(m.a.id, m.a.price, "cm-s2");
    await m.sign(m.a.id, m.a.price); // no member: opens cell 2 and completes 가로 1줄 — no one to get the bonus
    let board = (await m.view()).board!;
    expect(board.grids[0].cells.map((c) => (c.opened ? (c.opened.memberName ?? "-") : "."))).toEqual(["하늘", "하늘", "-", ".", ".", ".", ".", ".", "."]);
    expect(board.grids[0]).toMatchObject({ lines: [0], lastOpened: 2 });
    expect(m.runs(id).map((r) => [r.memberId, r.label, r.points])).toEqual([["", "빙고! 가로 1줄", 0]]);

    await m.sign(m.a.id, m.a.price, "cm-s2");
    await m.sign(m.a.id, m.a.price, "cm-s2");
    await m.sign(m.a.id, m.a.price, "cm-s3"); // 가로 2줄 by 바다
    expect(m.runs(id).map((r) => [r.memberId, r.label, r.points])).toEqual([
      ["", "빙고! 가로 1줄", 0],
      ["cm-s3", "빙고! 가로 2줄", 1_000]
    ]);
    // Another signature has no cell on this board.
    await m.sign(m.b.id, m.b.price, "cm-s3");
    board = (await m.view()).board!;
    expect(board.grids[0].cells.filter((c) => c.opened)).toHaveLength(6);
    // The bonus counts once the 빙고 shows on OBS.
    expect((await m.getBroadcastView())!.live!.rows.find((r) => r.memberId === "cm-s3")!.game).toBe(0);
    vi.setSystemTime(at(60));
    expect((await m.getBroadcastView())!.live!.rows.find((r) => r.memberId === "cm-s3")!.game).toBe(1_000);
    const overlay = await m.getOverlayScoreboard(m.overlayKey);
    expect(overlay !== "IDLE" && overlay !== "FORBIDDEN" && overlay.sigBingo.board!.grids[0].lines).toEqual([0, 1]);

    // Off: donations open nothing.
    await m.saveSigBingo(settings({ ...only(m.a), auto: false }));
    await m.sign(m.a.id, m.a.price, "cm-s2");
    expect((await m.view()).board!.grids[0].cells.filter((c) => c.opened)).toHaveLength(6);
  });

  it("땅따먹기: a member's 시그니처 후원 takes a cell; a line all one member's is their 빙고", async () => {
    const m = await load();
    const id = await m.start();
    await m.saveSigBingo(settings({ ...only(m.a), mode: "TERRITORY", bonus: 2_000 }));
    await m.startSigBingo({ broadcastId: id, requestId: key(1) });
    await m.sign(m.a.id, m.a.price); // no member: no cell
    for (let i = 0; i < 3; i++) await m.sign(m.a.id, m.a.price, "cm-s2");
    expect(m.runs(id).map((r) => [r.memberId, r.label, r.points])).toEqual([["cm-s2", "빙고! 가로 1줄", 2_000]]);
    await m.sign(m.a.id, m.a.price, "cm-s3");
    await m.sign(m.a.id, m.a.price, "cm-s2");
    await m.sign(m.a.id, m.a.price, "cm-s2"); // 가로 2줄 mixed: no 빙고
    expect(m.runs(id)).toHaveLength(1);
    expect((await m.view()).board!.grids[0].cells[3].opened).toMatchObject({ memberName: "바다", memberColor: "#3b82f6", manual: false });
  });

  it("BJ(개인) (2026-10-28): every active member has a board of their own, opened only by 시그니처 후원 to them", async () => {
    const m = await load();
    const id = await m.start();
    await m.saveSigBingo(settings({ ...only(m.a), mode: "SOLO", bonus: 1_000 }));
    expect(await m.startSigBingo({ broadcastId: id, requestId: key(1) })).toEqual({ status: "SAVED" });
    let board = (await m.view()).board!;
    expect(board.grids.map((g) => [g.key, g.label, g.color, g.members, g.cells.length])).toEqual([
      ["cm-s1", "길동", "#8b5cf6", ["cm-s1"], 9],
      ["cm-s2", "하늘", "#ec4899", ["cm-s2"], 9],
      ["cm-s3", "바다", "#3b82f6", ["cm-s3"], 9]
    ]);
    await m.sign(m.a.id, m.a.price); // no member: no board
    for (let i = 0; i < 3; i++) await m.sign(m.a.id, m.a.price, "cm-s2");
    await m.sign(m.a.id, m.a.price, "cm-s3");
    board = (await m.view()).board!;
    expect(board.grids.map((g) => g.cells.filter((c) => c.opened).length)).toEqual([0, 3, 1]);
    expect(board.grids[1]).toMatchObject({ lines: [0], lastOpened: 2 });
    expect(m.runs(id).map((r) => [r.memberId, r.label, r.points])).toEqual([["cm-s2", "빙고! 가로 1줄", 1_000]]);

    // By hand: always the board's member.
    expect(await m.setSigBingo({ broadcastId: id, grid: "cm-s3", index: 4, open: true, memberId: "cm-s1" })).toEqual({ status: "SAVED" });
    expect((await m.view()).board!.grids[2].cells[4].opened).toMatchObject({ memberName: "바다", manual: true });
    for (const grid of ["ALL", undefined, "constructor", "cm-s9"])
      expect(await m.setSigBingo({ broadcastId: id, grid, index: 0, open: true })).toEqual({ status: "INVALID", message: "빙고판을 다시 골라 주세요." });

    // A member activated after 빙고 시작 gets a board with their first 시그니처 후원.
    const { mockCrew, STUDIO_CHANNEL } = await import("./mockCrewStore");
    mockCrew.crews[STUDIO_CHANNEL]!.find((x) => x.id === "cm-s4")!.active = true;
    await m.sign(m.a.id, m.a.price, "cm-s4");
    const view = await m.view();
    expect(view.board!.grids.map((g) => [g.label, g.cells.filter((c) => c.opened).length])).toEqual([
      ["길동", 0],
      ["하늘", 3],
      ["바다", 2],
      ["솔", 1]
    ]);
    // 남은 시그 counts every board.
    expect(view.remaining).toMatchObject([{ signatureId: m.a.id, cells: 4 * 9 - 6 }]);
  });

  it("BJ(팀) (2026-10-28): A팀 · B팀 have a board each in a team broadcast; a member's 시그니처 후원 opens their team's", async () => {
    const m = await load();
    await m.saveSigBingo(settings({ ...only(m.a), mode: "TEAM", bonus: 500 }));
    const solo = await m.start();
    expect(await m.startSigBingo({ broadcastId: solo, requestId: key(1) })).toEqual({ status: "INVALID", message: "BJ(팀)은 팀 배틀 방송에서만 할 수 있어요." });
    expect(await m.endBroadcast(solo)).toEqual({ status: "SAVED" });
    vi.setSystemTime(at(5));
    expect(await m.startBroadcast({ requestId: crypto.randomUUID(), title: "팀 빙고", teamMode: true, teams: { "cm-s1": "A", "cm-s2": "B", "cm-s3": "B" } })).toEqual({ status: "SAVED" });
    const id = (await m.getBroadcastView())!.live!.id;
    expect(await m.startSigBingo({ broadcastId: id, requestId: key(2) })).toEqual({ status: "SAVED" });
    expect((await m.view()).board!.grids.map((g) => [g.key, g.label, g.color, g.members])).toEqual([
      ["A", "A팀", "#3b82f6", ["cm-s1"]],
      ["B", "B팀", "#ec4899", ["cm-s2", "cm-s3"]]
    ]);
    await m.sign(m.a.id, m.a.price); // no member: no board
    await m.sign(m.a.id, m.a.price, "cm-s2");
    await m.sign(m.a.id, m.a.price, "cm-s3");
    await m.sign(m.a.id, m.a.price, "cm-s1");
    await m.sign(m.a.id, m.a.price, "cm-s2"); // B팀 가로 1줄, by 하늘
    const grids = (await m.view()).board!.grids;
    expect(grids.map((g) => g.cells.filter((c) => c.opened).map((c) => c.opened!.memberName))).toEqual([["길동"], ["하늘", "바다", "하늘"]]);
    expect(grids[1]).toMatchObject({ lines: [0], lastOpened: 2 });
    expect(m.runs(id).map((r) => [r.memberId, r.label, r.points])).toEqual([["cm-s2", "B팀 빙고! 가로 1줄", 500]]);

    // By hand: a member of that team, or none.
    expect(await m.setSigBingo({ broadcastId: id, grid: "A", index: 4, open: true, memberId: "cm-s2" })).toEqual({ status: "INVALID", message: "A팀 멤버를 골라 주세요." });
    expect(await m.setSigBingo({ broadcastId: id, grid: "A", index: 4, open: true, memberId: null })).toEqual({ status: "SAVED" });
    expect(await m.setSigBingo({ broadcastId: id, grid: "A", index: 8, open: true, memberId: "cm-s1" })).toEqual({ status: "SAVED" });
    const a = (await m.view()).board!.grids[0];
    expect([a.cells[4].opened, a.cells[8].opened]).toMatchObject([{ memberName: null, manual: true }, { memberName: "길동", manual: true }]);
    // 대각선 ↘ (0 · 4 · 8) completed by hand for 길동.
    expect(m.runs(id).at(-1)).toMatchObject({ memberId: "cm-s1", label: "A팀 빙고! 대각선 ↘", points: 500, trigger: { kind: "MANUAL" } });
  });

  it("남은 시그: lists the closed cells by signature, cheapest first, and shows them on OBS when chosen", async () => {
    const m = await load();
    const id = await m.start();
    // Two signatures on a 3×3 board: each in turn, so one gets 5 cells and the other 4.
    const [x, y] = [m.a, m.b].sort((p, q) => p.price - q.price);
    const others = m.all.filter((s) => s.id !== x.id && s.id !== y.id).map((s) => s.id);
    expect(await m.saveSigBingo(settings({ excluded: others }))).toEqual({ status: "SAVED" });
    expect((await m.view()).remaining).toEqual([]); // no board yet
    await m.startSigBingo({ broadcastId: id, requestId: key(1) });
    let left = (await m.view()).remaining;
    expect(left.map((r) => r.signatureId)).toEqual([x, y].map((s) => s.id));
    expect(left.map((r) => r.cells).sort()).toEqual([4, 5]);
    expect(left[0]).toMatchObject({ name: x.name, price: x.price });

    await m.sign(x.id, x.price);
    left = (await m.view()).remaining;
    expect(left.reduce((s, r) => s + r.cells, 0)).toBe(8);

    // OBS gets the list too; the setting decides whether it is drawn (off by default, and for older screens).
    const obs = async () => {
      const overlay = await m.getOverlayScoreboard(m.overlayKey);
      if (overlay === "IDLE" || overlay === "FORBIDDEN") throw new Error("no overlay");
      return overlay.sigBingo;
    };
    expect((await obs()).settings.showRemaining).toBe(false);
    expect(await m.saveSigBingo(settings({ excluded: others, showRemaining: true }))).toEqual({ status: "SAVED" });
    expect((await obs())).toMatchObject({ settings: { showRemaining: true }, remaining: left });
    const { showRemaining: _off, ...older } = settings({ excluded: others });
    expect(_off).toBe(false);
    expect(await m.saveSigBingo(older)).toEqual({ status: "SAVED" });
    expect((await m.getGamesView())!.sigBingoSettings.showRemaining).toBe(false);
    expect((await m.saveSigBingo(settings({ showRemaining: "yes" as never }))).status).toBe("INVALID");

    // 잔여 시그 위치 (2026-10-28): below by default and for older screens, above when chosen.
    expect((await m.getGamesView())!.sigBingoSettings.remainingAt).toBe("BOTTOM");
    expect(await m.saveSigBingo(settings({ excluded: others, showRemaining: true, remainingAt: "TOP" }))).toEqual({ status: "SAVED" });
    expect((await obs()).settings).toMatchObject({ showRemaining: true, remainingAt: "TOP" });
    const { remainingAt: _at, ...beforeAt } = settings({ excluded: others, showRemaining: true });
    expect(_at).toBe("BOTTOM");
    expect(await m.saveSigBingo(beforeAt)).toEqual({ status: "SAVED" });
    expect((await m.getGamesView())!.sigBingoSettings.remainingAt).toBe("BOTTOM");
    expect((await m.saveSigBingo(settings({ remainingAt: "LEFT" as never }))).status).toBe("INVALID");
  });

  it("lets the operator open and close cells", async () => {
    const m = await load();
    const id = await m.start();
    const set = (index: unknown, open: unknown, memberId: string | null = null) => m.setSigBingo({ broadcastId: id, index, open, memberId });
    expect(await set(0, true)).toEqual({ status: "INVALID", message: "빙고를 먼저 시작해 주세요." });
    await m.saveSigBingo(settings({ ...only(m.a), mode: "TERRITORY", bonus: 500 }));
    await m.startSigBingo({ broadcastId: id, requestId: key(1) });
    expect(await set(0, true)).toEqual({ status: "INVALID", message: "땅따먹기에서는 칸을 차지할 멤버를 골라 주세요." });
    for (const i of [0, 4, 8]) expect(await set(i, true, "cm-s1")).toEqual({ status: "SAVED" }); // 대각선 ↘
    expect(m.runs(id).map((r) => [r.memberId, r.label, r.points, r.trigger])).toEqual([["cm-s1", "빙고! 대각선 ↘", 500, { kind: "MANUAL" }]]);
    expect((await m.view()).board!.grids[0].cells[4].opened).toMatchObject({ memberName: "길동", manual: true });
    expect(await set(4, false)).toEqual({ status: "INVALID", message: "빙고 줄에 들어간 칸은 닫을 수 없어요." });
    await set(1, true, "cm-s2");
    expect(await set(1, true, "cm-s3")).toEqual({ status: "SAVED" }); // already open: no-op
    expect((await m.view()).board!.grids[0].cells[1].opened).toMatchObject({ memberName: "하늘" });
    expect(await set(1, false)).toEqual({ status: "SAVED" });
    expect((await m.view()).board!.grids[0].cells[1].opened).toBeNull();
    for (const bad of [9, -1, 1.5, "0"]) expect(await set(bad, true, "cm-s2")).toEqual({ status: "INVALID", message: "칸을 다시 골라 주세요." });
    expect(await set(2, "yes")).toEqual({ status: "INVALID", message: "칸을 다시 골라 주세요." });
    signIn(["SUPPORTER"]);
    expect(await set(2, true, "cm-s2")).toEqual({ status: "UNAUTHORIZED" });
  });
});
