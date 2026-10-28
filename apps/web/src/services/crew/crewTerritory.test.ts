import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import { DEFAULT_TERRITORY, territoryCoord, type TerritorySettings } from "./crewTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 땅따먹기 (2026-10-24, StreamDonate 땅따먹기 참고) on the 점수 게임 engine. */
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
  const [a, b] = (await signatures.listSignatures())!;
  let n = 0;
  const sign = (memberId?: string, s = a) =>
    requestDonation({ creatorId: "studio", hideProfile: false, type: "SIGNATURE", signatureId: s.id, message: "", amount: s.price, expectedAmount: s.price, idempotencyKey: key(++n), memberId });
  const text = (amount: number, memberId?: string) =>
    requestDonation({ creatorId: "studio", hideProfile: false, type: "TEXT", amount, message: "땅!", voiceId: null, idempotencyKey: key(++n), memberId });
  // The seed attributions are stamped when the store is made (T0): the broadcast starts a second later.
  const start = async () => {
    vi.setSystemTime(at(1));
    expect(await bc.startBroadcast({ requestId: crypto.randomUUID(), title: "땅따먹기 방송", teamMode: false })).toEqual({ status: "SAVED" });
    return (await bc.getBroadcastView())!.live!.id;
  };
  const view = async () => (await games.getGamesView())!.live!.territory;
  const hearts = async () => Object.fromEntries((await view()).members.map((m) => [m.memberId, m.hearts]));
  const runs = (id: string) => (mockCrew.broadcasts!.find((x) => x.id === id)!.gameRuns ?? []).filter((r) => r.game === "TERRITORY");
  const gamePoints = async (memberId: string) => (await bc.getBroadcastView())!.live!.rows.find((r) => r.memberId === memberId)!.game;
  return { ...bc, ...games, a, b, sign, text, start, view, hearts, runs, gamePoints, overlayKey: mockCreator.integrationKey };
}

const T0 = new Date("2026-10-24T12:00:00Z");
const at = (sec: number) => new Date(T0.getTime() + sec * 1000);
const settings = (patch: Partial<TerritorySettings> = {}) => ({ ...DEFAULT_TERRITORY, auto: true, ...patch });

describe("땅따먹기 좌표", () => {
  it("names a cell by column letter and row number", () => {
    expect([0, 1, 4, 5, 24].map((i) => territoryCoord(5, i))).toEqual(["A1", "B1", "E1", "A2", "E5"]);
    expect(territoryCoord(10, 99)).toBe("J10");
  });
});

describe("땅따먹기", () => {
  beforeEach(() => {
    resetMockStores();
    vi.useFakeTimers({ now: T0, toFake: ["Date"] });
  });
  afterEach(() => vi.useRealTimers());

  it("validates and saves the settings", async () => {
    const m = await load();
    expect(await m.saveTerritory(settings({ size: 6, heartMode: "SIGNATURE", heartPoints: 5_000, cellPoints: 300 }))).toEqual({ status: "SAVED" });
    expect((await m.getGamesView())!.territorySettings).toMatchObject({ size: 6, heartMode: "SIGNATURE", heartPoints: 5_000, cellPoints: 300 });
    const bad: [Record<string, unknown>, string][] = [
      [{ size: 4 }, "판 크기"],
      [{ size: 11 }, "판 크기"],
      [{ heartMode: "TIME" }, "하트 받는 방식"],
      [{ heartPoints: 0 }, "하트 기준 점수는 1 ~ 10,000,000점"],
      [{ heartPoints: 1.5 }, "하트 기준 점수는"],
      [{ cellPoints: -1 }, "칸 점수는 0 ~ 1,000,000점"],
      [{ cellPoints: 1_000_001 }, "칸 점수는"],
      [{ excluded: ["sig-nope"] }, "제외할 시그니처"]
    ];
    for (const [patch, message] of bad) {
      const res = await m.saveTerritory(settings(patch as Partial<TerritorySettings>));
      expect(res.status === "INVALID" && res.message, message).toContain(message);
    }
    signIn(["SUPPORTER"]);
    expect(await m.saveTerritory(settings())).toEqual({ status: "UNAUTHORIZED" });
  });

  it("점유 롤링 표시 · 땅따먹기 전용 BJ 색상 (2026-10-28): kept with the settings, the colors only in 땅따먹기", async () => {
    const m = await load();
    const id = await m.start();
    const older: Record<string, unknown> = { ...settings() };
    delete older.ticker;
    delete older.colors;
    // A screen from before sends neither: off, crew colors.
    expect(await m.saveTerritory(older)).toEqual({ status: "SAVED" });
    expect((await m.getGamesView())!.territorySettings).toMatchObject({ ticker: "OFF", colors: {} });

    expect(await m.saveTerritory(settings({ ticker: "BOTTOM", colors: { "cm-s2": "#00AA11" } }))).toEqual({ status: "SAVED" });
    expect((await m.getGamesView())!.territorySettings).toMatchObject({ ticker: "BOTTOM", colors: { "cm-s2": "#00aa11" } });
    await m.startTerritory({ broadcastId: id, requestId: key(90) });
    const colors = Object.fromEntries((await m.view()).members.map((x) => [x.memberId, x.color]));
    expect(colors).toMatchObject({ "cm-s1": "#8b5cf6", "cm-s2": "#00aa11", "cm-s3": "#3b82f6" });
    // Other features keep the crew color.
    expect((await m.getBroadcastView())!.live!.rows.find((r) => r.memberId === "cm-s2")!.color).toBe("#ec4899");
    const overlay = await m.getOverlayScoreboard(m.overlayKey);
    expect(overlay !== "IDLE" && overlay !== "FORBIDDEN" && overlay.territory.settings.ticker).toBe("BOTTOM");

    const bad: [Record<string, unknown>, string][] = [
      [{ ticker: "LEFT" }, "점유 롤링 표시"],
      [{ colors: { "cm-s2": "red" } }, "#RRGGBB"],
      [{ colors: { "cm-nope": "#112233" } }, "BJ 색상의 멤버"],
      [{ colors: ["#112233"] }, "BJ 색상을 확인"]
    ];
    for (const [patch, message] of bad) {
      const res = await m.saveTerritory(settings(patch as Partial<TerritorySettings>));
      expect(res.status === "INVALID" && res.message, message).toContain(message);
    }
  });

  it("starts an empty board of the saved size", async () => {
    const m = await load();
    expect(await m.startTerritory({ broadcastId: "bc-x", requestId: key(1) })).toEqual({ status: "INVALID", message: "진행 중인 방송이 아니에요." });
    const id = await m.start();
    await m.saveTerritory(settings({ size: 5 }));
    expect((await m.view()).board).toBeNull();
    expect(await m.startTerritory({ broadcastId: id, requestId: key(1) })).toEqual({ status: "SAVED" });
    const board = (await m.view()).board!;
    expect(board).toMatchObject({ boardId: key(1), size: 5, lastCell: null });
    expect(board.cells).toHaveLength(25);
    expect(board.cells.every((c) => c.owners.length === 0)).toBe(true);
    expect((await m.view()).members.map((x) => [x.name, x.hearts])).toEqual([
      ["길동", 0],
      ["하늘", 0],
      ["바다", 0]
    ]);
    expect(await m.startTerritory({ broadcastId: id, requestId: key(1) })).toEqual({ status: "SAVED" }); // retried: same board
    expect((await m.view()).board!.boardId).toBe(key(1));
    expect(await m.playGame({ game: "TERRITORY", broadcastId: id, requestId: key(2), memberId: "cm-s2" })).toEqual({ status: "INVALID", message: "땅따먹기는 칸을 눌러 멤버에게 할당해요." });
    expect(await m.clearTerritory({ broadcastId: id })).toEqual({ status: "SAVED" });
    expect((await m.view()).board).toBeNull();
    signIn(["SUPPORTER"]);
    expect(await m.startTerritory({ broadcastId: id, requestId: key(3) })).toEqual({ status: "UNAUTHORIZED" });
  });

  it("gives a member 하트 for what they receive: per 하트 기준 점수, or per 시그니처 후원", async () => {
    const m = await load();
    const id = await m.start();
    await m.sign("cm-s2"); // no board yet
    await m.saveTerritory(settings({ heartPoints: 1_000, excluded: [m.b.id] }));
    await m.startTerritory({ broadcastId: id, requestId: key(1) });
    await m.sign("cm-s2");
    await m.text(2_500, "cm-s2");
    await m.text(900, "cm-s3"); // under one 하트
    await m.sign(); // no member
    await m.sign("cm-s3", m.b); // excluded signature
    expect(await m.hearts()).toEqual({ "cm-s1": 0, "cm-s2": Math.floor(m.a.price / 1_000) + 2, "cm-s3": 0 });

    await m.saveTerritory(settings({ heartMode: "SIGNATURE" }));
    await m.sign("cm-s3");
    await m.text(50_000, "cm-s3"); // no signature: no 하트
    expect((await m.hearts())["cm-s3"]).toBe(1);
    await m.saveTerritory(settings({ heartMode: "SIGNATURE", auto: false }));
    await m.sign("cm-s3");
    expect((await m.hearts())["cm-s3"]).toBe(1);
    // A new board starts without 하트.
    await m.startTerritory({ broadcastId: id, requestId: key(2) });
    expect((await m.hearts())["cm-s3"]).toBe(0);
  });

  it("assigns a cell for a 하트; an owned cell is taken over and its 칸 점수 moves", async () => {
    const m = await load();
    const id = await m.start();
    await m.saveTerritory(settings({ size: 5, heartMode: "SIGNATURE", cellPoints: 500 }));
    await m.startTerritory({ broadcastId: id, requestId: key(1) });
    const assign = (requestId: string, index: unknown, memberId: unknown, boardId: unknown = key(1)) => m.assignTerritory({ broadcastId: id, boardId, requestId, index, memberId });
    expect(await assign(key(2), 0, "cm-s2")).toEqual({ status: "INVALID", message: "하늘의 하트가 없어요." });
    await m.sign("cm-s2");
    expect(await assign(key(3), 0, "cm-s2")).toEqual({ status: "SAVED" });
    expect(await assign(key(3), 0, "cm-s2")).toEqual({ status: "SAVED" }); // retried: no more
    expect(await m.hearts()).toMatchObject({ "cm-s2": 0 });
    expect(await assign(key(4), 1, "cm-s2")).toEqual({ status: "INVALID", message: "하늘의 하트가 없어요." });
    await m.sign("cm-s2");
    expect(await assign(key(5), 0, "cm-s2")).toEqual({ status: "INVALID", message: "이미 그 멤버의 칸이에요." });
    await m.sign("cm-s3");
    expect(await assign(key(6), 0, "cm-s3")).toEqual({ status: "SAVED" });
    expect(m.runs(id).map((r) => [r.memberId, r.label, r.kind, r.points, r.itemId, r.shares])).toEqual([
      ["cm-s2", "A1 점령", "ADD", 500, "A1", undefined],
      ["cm-s3", "A1 빼앗기 (하늘)", "ADD", 500, "A1", [{ memberId: "cm-s2", points: -500 }]]
    ]);
    const board = (await m.view()).board!;
    expect(board.cells[0].owners.map((o) => o.memberId)).toEqual(["cm-s2", "cm-s3"]);
    expect(board.lastCell).toBe(0);
    expect(await m.hearts()).toMatchObject({ "cm-s2": 1, "cm-s3": 0 });
    // The points move once each result shows.
    vi.setSystemTime(at(120));
    expect([await m.gamePoints("cm-s2"), await m.gamePoints("cm-s3")]).toEqual([0, 500]);
    const obs = await m.getOverlayScoreboard(m.overlayKey);
    expect(obs !== "IDLE" && obs !== "FORBIDDEN" && obs.territory.board!.cells[0].owners).toHaveLength(2);

    expect(await assign(key(7), 1, "cm-s2", "old")).toEqual({ status: "INVALID", message: "판이 바뀌었어요. 칸을 다시 골라 주세요." });
    for (const bad of [25, -1, 1.5, "0"]) expect(await assign(key(8), bad, "cm-s2")).toEqual({ status: "INVALID", message: "칸을 다시 골라 주세요." });
    expect(await assign(key(9), 1, "cm-s4")).toEqual({ status: "INVALID", message: "칸을 받을 멤버를 골라 주세요." }); // 휴식
    signIn(["SUPPORTER"]);
    expect(await assign(key(10), 1, "cm-s2")).toEqual({ status: "UNAUTHORIZED" });
  });

  it("lets the operator add or take a 하트", async () => {
    const m = await load();
    const id = await m.start();
    const adjust = (requestId: string, memberId: unknown, delta: unknown) => m.adjustTerritory({ broadcastId: id, requestId, memberId, delta });
    expect(await adjust(key(1), "cm-s1", 1)).toEqual({ status: "INVALID", message: "판을 먼저 시작해 주세요." });
    await m.startTerritory({ broadcastId: id, requestId: key(2) });
    expect(await adjust(key(3), "cm-s1", 1)).toEqual({ status: "SAVED" });
    expect(await adjust(key(3), "cm-s1", 1)).toEqual({ status: "SAVED" }); // retried: once
    expect(await adjust(key(4), "cm-s1", 1)).toEqual({ status: "SAVED" });
    expect(await adjust(key(5), "cm-s1", -1)).toEqual({ status: "SAVED" });
    expect((await m.hearts())["cm-s1"]).toBe(1);
    expect(await adjust(key(6), "cm-s2", -1)).toEqual({ status: "INVALID", message: "뺄 하트가 없어요." });
    expect(await adjust(key(7), "cm-s1", 2)).toEqual({ status: "INVALID", message: "잘못된 요청입니다." });
    expect(await adjust(key(8), "cm-s4", 1)).toEqual({ status: "INVALID", message: "멤버를 다시 골라 주세요." });
    signIn(["SUPPORTER"]);
    expect(await adjust(key(9), "cm-s1", 1)).toEqual({ status: "UNAUTHORIZED" });
  });
});
