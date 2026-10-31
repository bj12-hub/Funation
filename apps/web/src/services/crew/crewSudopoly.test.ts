import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import { DEFAULT_SUDOPOLY, sudopolyCell, type SudopolySettings } from "./crewTypes";

/** Queued server rolls (randomInt) for the next draws; empty = real randomness. A die roll r is the face r + 1. */
const rolls = vi.hoisted(() => [] as number[]);
vi.mock("node:crypto", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:crypto")>();
  return { ...real, randomInt: (...args: Parameters<typeof real.randomInt>) => (rolls.length ? rolls.shift()! : (real.randomInt as (max: number) => number)(args[0] as number)) };
});
vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 스도폴리 (2026-10-24, StreamDonate 스도폴리 참고) on the 점수 게임 engine. */
async function load() {
  const bc = await import("./crewBroadcast");
  const games = await import("./crewGames");
  const core = await import("./crewSudopolyCore");
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
    expect(await bc.startBroadcast({ requestId: crypto.randomUUID(), title: "스도폴리 방송", teamMode: false })).toEqual({ status: "SAVED" });
    return (await bc.getBroadcastView())!.live!.id;
  };
  const view = async () => (await games.getGamesView())!.live!.sudopoly;
  const piece = async (k: string) => (await view()).pieces.find((p) => p.key === k)!;
  const runs = (id: string) => (mockCrew.broadcasts!.find((x) => x.id === id)!.gameRuns ?? []).filter((r) => r.game === "SUDOPOLY");
  const gamePoints = async (memberId: string) => (await bc.getBroadcastView())!.live!.rows.find((r) => r.memberId === memberId)!.game;
  return { ...bc, ...games, core, a, sign, start, view, piece, runs, gamePoints, overlayKey: mockCreator.integrationKey };
}

const T0 = new Date("2026-10-24T12:00:00Z");
const at = (sec: number) => new Date(T0.getTime() + sec * 1000);
/** 8 칸: 출발 · +1000 · 애교 · 황금열쇠 · 무인도 · -500 · 황금열쇠 · 노래. */
const SPACES = [
  { id: "s0", kind: "START", label: "출발", value: 0 },
  { id: "s1", kind: "POINTS", label: "+1000", value: 1_000 },
  { id: "s2", kind: "TEXT", label: "애교", value: 0 },
  { id: "s3", kind: "KEY", label: "황금열쇠", value: 0 },
  { id: "s4", kind: "ISLAND", label: "무인도", value: 0 },
  { id: "s5", kind: "POINTS", label: "-500", value: -500 },
  { id: "s6", kind: "KEY", label: "황금열쇠", value: 0 },
  { id: "s7", kind: "TEXT", label: "노래", value: 0 }
] as SudopolySettings["spaces"];
/** 4 cards of 가중치 1: a card roll r is card r. */
const KEYS = [
  { id: "k0", label: "+3000", kind: "POINTS", value: 3_000, weight: 1 },
  { id: "k1", label: "2칸 앞으로", kind: "MOVE", value: 2, weight: 1 },
  { id: "k2", label: "출발로", kind: "START", value: 0, weight: 1 },
  { id: "k3", label: "무인도로", kind: "ISLAND", value: 0, weight: 1 }
] as SudopolySettings["keys"];
const settings = (patch: Partial<SudopolySettings> = {}) => ({ ...DEFAULT_SUDOPOLY, auto: true, spaces: SPACES, keys: KEYS, startBonus: 1_000, ...patch });

describe("스도폴리 판 · 굴림 수", () => {
  it("lays a loop of 칸 round a square, 출발 bottom-right", () => {
    expect(Array.from({ length: 8 }, (_, i) => sudopolyCell(8, i)).map((c) => `${c.row},${c.col}`)).toEqual(["2,2", "2,1", "2,0", "1,0", "0,0", "0,1", "0,2", "1,2"]);
    expect(sudopolyCell(40, 10)).toEqual({ row: 10, col: 0 });
    expect(sudopolyCell(40, 39)).toEqual({ row: 9, col: 10 });
  });

  it("gives a donation the rolls of the highest 금액 구간 it reaches", async () => {
    const { sudopolyRolls } = await import("./crewSudopolyCore");
    const tiers = [
      { id: "t2", min: 50_000, rolls: 3 },
      { id: "t0", min: 1_000, rolls: 1 },
      { id: "t1", min: 10_000, rolls: 2 }
    ];
    expect([500, 1_000, 9_999, 10_000, 1_000_000].map((x) => sudopolyRolls(tiers, x))).toEqual([0, 1, 1, 2, 3]);
  });
});

describe("스도폴리", () => {
  beforeEach(() => {
    resetMockStores();
    rolls.length = 0;
    vi.useFakeTimers({ now: T0, toFake: ["Date"] });
  });
  afterEach(() => vi.useRealTimers());

  it("validates and saves the settings", async () => {
    const m = await load();
    const tiers = [
      { id: "new-2", min: 50_000, rolls: 3 },
      { id: "new-1", min: 0, rolls: 1 }
    ];
    expect(await m.saveSudopoly(settings({ pieceMode: "SHARED", tiers, islandTurns: 2, goalLaps: 3, goalBonus: 10_000 }))).toEqual({ status: "SAVED" });
    const saved = (await m.getGamesView())!.sudopolySettings;
    expect(saved).toMatchObject({ pieceMode: "SHARED", startBonus: 1_000, islandTurns: 2, goalLaps: 3, goalBonus: 10_000 });
    expect(saved.spaces.map((x) => [x.kind, x.label, x.value])).toEqual(SPACES.map((x) => [x.kind, x.label, x.value]));
    expect(saved.tiers.map((t) => [t.min, t.rolls])).toEqual([
      [0, 1],
      [50_000, 3]
    ]);
    expect([...saved.spaces, ...saved.keys, ...saved.tiers].every((x) => /^(sp|sk|st)-/.test(x.id))).toBe(true);
    expect(await m.saveSudopoly(saved)).toEqual({ status: "SAVED" }); // saved ids are kept
    expect((await m.getGamesView())!.sudopolySettings.spaces.map((x) => x.id)).toEqual(saved.spaces.map((x) => x.id));
    expect(await m.saveSudopoly(settings({ spaces: [], keys: [] }))).toEqual({ status: "SAVED" }); // no board yet

    const space = (i: number, patch: Record<string, unknown>) => SPACES.map((x, j) => (j === i ? { ...x, ...patch } : x));
    const card = (patch: Record<string, unknown>) => [{ ...KEYS[0], ...patch }];
    const bad: [Record<string, unknown>, string][] = [
      [{ pieceMode: "TEAM" }, "말 방식"],
      [{ spaces: SPACES.slice(0, 4) }, "칸은 8 ~ 40개, 4의 배수"],
      [{ spaces: [...SPACES, SPACES[1]] }, "칸은 8 ~ 40개, 4의 배수"],
      [{ spaces: space(0, { kind: "TEXT" }) }, "첫 칸만 출발"],
      [{ spaces: space(3, { kind: "START" }) }, "첫 칸만 출발"],
      [{ spaces: space(2, { kind: "BANK" }) }, "3번 칸 종류"],
      [{ spaces: space(2, { label: " " }) }, "3번 칸 이름은 1~12자"],
      [{ spaces: space(2, { label: "가".repeat(13) }) }, "3번 칸 이름은"],
      [{ spaces: space(2, { label: "운영자" }) }, "사용할 수 없는 단어"],
      [{ spaces: space(1, { value: 0 }) }, "2번 칸 점수는"],
      [{ spaces: space(1, { value: 1.5 }) }, "2번 칸 점수는"],
      [{ keys: [] }, "황금열쇠 칸이 있으면 카드를"],
      [{ keys: Array.from({ length: 21 }, () => KEYS[0]) }, "황금열쇠 카드는 20장까지"],
      [{ keys: card({ kind: "BOMB" }) }, "황금열쇠 카드 종류"],
      [{ keys: card({ label: "" }) }, "황금열쇠 문구는 1~20자"],
      [{ keys: card({ value: 0 }) }, "황금열쇠 점수는"],
      [{ keys: card({ kind: "MOVE", value: 11 }) }, "황금열쇠 이동은 ±10칸"],
      [{ keys: card({ kind: "ISLAND" }), spaces: space(4, { kind: "TEXT" }) }, "무인도 칸이 없어"],
      [{ keys: card({ weight: 0 }) }, "황금열쇠 가중치는"],
      [{ tiers: Array.from({ length: 11 }, (_, i) => ({ id: `t${i}`, min: i, rolls: 1 })) }, "금액 구간은 10개까지"],
      [{ tiers: [{ id: "t", min: 0, rolls: 11 }] }, "굴림 1 ~ 10번"],
      [{ tiers: [{ id: "t", min: -1, rolls: 1 }] }, "굴림 1 ~ 10번"],
      [{ tiers: [{ id: "t", min: 0, rolls: 1 }, { id: "u", min: 0, rolls: 2 }] }, "최소 금액이 겹쳐요"],
      [{ startBonus: -1 }, "출발 보너스는"],
      [{ islandTurns: 0 }, "무인도는 1 ~ 5번"],
      [{ goalLaps: 21 }, "목표 바퀴는 0 ~ 20바퀴"],
      [{ goalBonus: -1 }, "완주 보너스는"],
      [{ excluded: ["sig-nope"] }, "제외할 시그니처"]
    ];
    for (const [patch, message] of bad) {
      const res = await m.saveSudopoly(settings(patch as Partial<SudopolySettings>));
      expect(res.status === "INVALID" && res.message, message).toContain(message);
    }
    signIn(["SUPPORTER"]);
    expect(await m.saveSudopoly(settings())).toEqual({ status: "UNAUTHORIZED" });
  });

  it("a 시그니처 후원 moves the member's piece: 칸 · 황금열쇠 · 출발 보너스 · 더블 · 무인도", async () => {
    const m = await load();
    const id = await m.start();
    await m.saveSudopoly(settings());
    rolls.push(0, 1, 0); // 1 + 2 → 황금열쇠 (3) · +3000
    await m.sign("cm-s2");
    rolls.push(0, 0, 1, 2); // 1 + 1 더블 → -500 (5), again: 2 + 3 → past 출발 to 애교 (2)
    await m.sign("cm-s2");
    rolls.push(0, 2, 3); // 1 + 3 → 황금열쇠 (6) · 무인도로 (4)
    await m.sign("cm-s2");
    rolls.push(0, 1); // no 더블: sits out on 무인도
    await m.sign("cm-s2");
    rolls.push(0, 1); // 1 + 2 → 노래 (7)
    await m.sign("cm-s2");
    expect(m.runs(id).map((r) => [r.dice, r.label, r.kind, r.points, r.move])).toEqual([
      [[1, 2], "황금열쇠 · +3000", "ADD", 3_000, { piece: "cm-s2", from: 0, to: 3, laps: 0 }],
      [[1, 1], "-500", "ADD", -500, { piece: "cm-s2", from: 3, to: 5, laps: 0 }],
      [[2, 3], "애교 · 출발 보너스", "ADD", 1_000, { piece: "cm-s2", from: 5, to: 2, laps: 1 }],
      [[1, 3], "황금열쇠 · 무인도로", "TEXT", 0, { piece: "cm-s2", from: 2, to: 4, laps: 1 }],
      [[1, 2], "무인도 (남은 0번)", "TEXT", 0, { piece: "cm-s2", from: 4, to: 4, laps: 1 }],
      [[1, 2], "노래", "TEXT", 0, { piece: "cm-s2", from: 4, to: 7, laps: 1 }]
    ]);
    expect(m.runs(id)[2].id).toBe(`${m.runs(id)[1].id}-1`);
    expect(await m.piece("cm-s2")).toMatchObject({ name: "하늘", pos: 7, laps: 1, island: 0 });
    expect(await m.piece("cm-s3")).toMatchObject({ pos: 0 });
    expect((await m.view()).runs[0].move).toEqual({ piece: "cm-s2", from: 4, to: 7, laps: 1 });
    vi.setSystemTime(at(300));
    expect(await m.gamePoints("cm-s2")).toBe(3_000 - 500 + 1_000);
    const obs = await m.getOverlayScoreboard(m.overlayKey);
    expect(obs !== "IDLE" && obs !== "FORBIDDEN" && obs.sudopoly.pieces.find((p) => p.key === "cm-s2")!.pos).toBe(7);

    // No member, or 자동 off: no roll.
    const before = m.runs(id).length;
    await m.sign();
    await m.saveSudopoly(settings({ auto: false }));
    await m.sign("cm-s2");
    expect(m.runs(id)).toHaveLength(before);
  });

  it("더블 three times goes to 무인도; a 더블 gets off it without another roll; cards move · send to 출발; 목표 바퀴 pays", async () => {
    const m = await load();
    const id = await m.start();
    await m.saveSudopoly(settings({ goalLaps: 2, goalBonus: 5_000 }));
    rolls.push(0, 0, 0, 0, 0, 0); // 2 → 애교, 2 → 무인도, then the third 더블: to 무인도
    await m.sign("cm-s1");
    rolls.push(2, 2); // 3 + 3 더블 on 무인도: off it, 4 + 6 → past 출발 to 애교, no roll again
    await m.sign("cm-s1");
    rolls.push(0, 2, 1); // 1 + 3 → 황금열쇠 (6) · 2칸 앞으로 → past 출발 to 0: the 2nd lap
    await m.sign("cm-s1");
    rolls.push(0, 1, 2); // 1 + 2 → 황금열쇠 (3) · 출발로
    await m.sign("cm-s1");
    expect(m.runs(id).map((r) => [r.label, r.points, r.move!.to, r.move!.laps])).toEqual([
      ["애교", 0, 2, 0],
      ["무인도", 0, 4, 0],
      ["더블 3번 · 무인도로", 0, 4, 0],
      ["애교 · 무인도 탈출 · 출발 보너스", 1_000, 2, 1],
      ["황금열쇠 · 2칸 앞으로 · 출발 보너스 · 2바퀴 완주", 1_000 + 5_000, 0, 0],
      ["황금열쇠 · 출발로 · 출발 보너스", 1_000, 0, 1]
    ]);
  });

  it("참여 BJ · 캐릭터 (2026-10-28): a member sitting out has no piece and does not roll; a 캐릭터 shows on the piece", async () => {
    const m = await load();
    const id = await m.start();
    const older: Record<string, unknown> = { ...settings() };
    delete older.sitOut;
    delete older.characters;
    // A screen from before sends neither: everyone plays, initials.
    expect(await m.saveSudopoly(older)).toEqual({ status: "SAVED" });
    expect((await m.getGamesView())!.sudopolySettings).toMatchObject({ sitOut: [], characters: {} });

    // A member removed since drops out of both.
    expect(await m.saveSudopoly(settings({ sitOut: ["cm-s3", "cm-gone"], characters: { "cm-s1": "DJ", "cm-gone": "CAT" } }))).toEqual({ status: "SAVED" });
    expect((await m.getGamesView())!.sudopolySettings).toMatchObject({ sitOut: ["cm-s3"], characters: { "cm-s1": "DJ" } });
    expect((await m.view()).pieces.map((p) => [p.key, p.emoji])).toEqual([
      ["cm-s1", "🎧"],
      ["cm-s2", null]
    ]);
    await m.sign("cm-s3"); // sits out: no roll
    expect(m.runs(id)).toHaveLength(0);
    expect(await m.playGame({ game: "SUDOPOLY", broadcastId: id, requestId: key(70), memberId: "cm-s3", sourceId: null })).toEqual({ status: "INVALID", message: "스도폴리에 참여하지 않는 BJ예요." });
    await m.sign("cm-s1");
    expect(m.runs(id).length).toBeGreaterThan(0);
    // 공용 말 ignores both.
    await m.saveSudopoly(settings({ pieceMode: "SHARED", sitOut: ["cm-s3"], characters: { "cm-s1": "DJ" } }));
    expect((await m.view()).pieces.map((p) => [p.key, p.emoji])).toEqual([["SHARED", null]]);

    for (const [patch, message] of [
      [{ sitOut: "cm-s3" }, "참여 BJ"],
      [{ sitOut: [3] }, "참여 BJ"],
      [{ characters: { "cm-s1": "DRAGON" } }, "캐릭터"],
      [{ characters: ["DJ"] }, "캐릭터"]
    ] as const) {
      const res = await m.saveSudopoly(settings(patch as unknown as Partial<SudopolySettings>));
      expect(res.status === "INVALID" && res.message, message).toContain(message);
    }
  });

  it("공용 말 moves for every member; 금액 구간 give more rolls; 수동 rolls once; 판 다시 시작", async () => {
    const m = await load();
    const id = await m.start();
    const play = (requestId: string, memberId = "cm-s3") => m.playGame({ game: "SUDOPOLY", broadcastId: id, requestId, memberId, sourceId: null });
    expect(await play(key(1))).toEqual({ status: "INVALID", message: "먼저 스도폴리 판을 만들어 주세요." });
    await m.saveSudopoly(settings({ pieceMode: "SHARED", tiers: [{ id: "t", min: m.a.price, rolls: 2 }] }));
    rolls.push(0, 1, 0, 1, 3); // two rolls: 1 + 2 → 황금열쇠 · +3000 (card 0), then 2 + 4 → +1000 (1), past 출발
    await m.sign("cm-s2");
    expect(m.runs(id).map((r) => [r.memberId, r.label, r.points, r.move!.piece])).toEqual([
      ["cm-s2", "황금열쇠 · +3000", 3_000, "SHARED"],
      ["cm-s2", "+1000 · 출발 보너스", 2_000, "SHARED"]
    ]);
    rolls.push(0, 1); // 1 + 2 → 무인도 (4)
    expect(await play(key(2))).toMatchObject({ status: "PLAYED", run: { memberName: "바다", label: "무인도", move: { piece: "SHARED", from: 1, to: 4 } } });
    expect(await play(key(2))).toMatchObject({ status: "PLAYED" }); // retried: the same roll
    expect(m.runs(id)).toHaveLength(3);
    expect((await m.view()).pieces).toEqual([{ key: "SHARED", name: "공용 말", color: null, emoji: null, pos: 4, laps: 1, island: 1 }]);
    expect(await m.resetSudopoly({ broadcastId: id })).toEqual({ status: "SAVED" });
    expect((await m.view()).pieces[0]).toMatchObject({ pos: 0, laps: 0, island: 0 });
    expect(await m.resetSudopoly({ broadcastId: "bc-x" })).toEqual({ status: "INVALID", message: "진행 중인 방송이 아니에요." });
    signIn(["SUPPORTER"]);
    expect(await m.resetSudopoly({ broadcastId: id })).toEqual({ status: "UNAUTHORIZED" });
  });
});
