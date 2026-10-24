import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import { DEFAULT_ALPHABET, alphabetBoardAt, type AlphabetSettings } from "./crewTypes";

/** Queued server rolls (randomInt) for the next draws; empty = real randomness. */
const rolls = vi.hoisted(() => [] as number[]);
vi.mock("node:crypto", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:crypto")>();
  return { ...real, randomInt: (...args: Parameters<typeof real.randomInt>) => (rolls.length ? rolls.shift()! : (real.randomInt as (max: number) => number)(args[0] as number)) };
});
vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 알파벳 모으기 (2026-10-24, StreamDonate 알파벳 모으기 참고) on the 점수 게임 engine. */
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
  // The seed attributions are stamped when the store is made (T0): the broadcast starts a second later.
  const start = async () => {
    vi.setSystemTime(at(1));
    expect(await bc.startBroadcast({ requestId: crypto.randomUUID(), title: "알파벳 방송", teamMode: false })).toEqual({ status: "SAVED" });
    return (await bc.getBroadcastView())!.live!.id;
  };
  const view = async () => (await games.getGamesView())!.live!.alphabet;
  const board = async (memberId: string) => (await view()).boards.find((x) => x.memberId === memberId)!;
  const filled = async (memberId: string) => (await board(memberId)).slots.map((x) => (x.revealAt ? x.letter : "_")).join("");
  const runs = (id: string) => (mockCrew.broadcasts!.find((x) => x.id === id)!.gameRuns ?? []).filter((r) => r.game === "ALPHABET");
  const gamePoints = async (memberId: string) => (await bc.getBroadcastView())!.live!.rows.find((r) => r.memberId === memberId)!.game;
  return { ...bc, ...games, a, b, sign, start, view, board, filled, runs, gamePoints, overlayKey: mockCreator.integrationKey };
}

const T0 = new Date("2026-10-24T12:00:00Z");
const at = (sec: number) => new Date(T0.getTime() + sec * 1000);
const settings = (patch: Partial<AlphabetSettings> = {}) => ({ ...DEFAULT_ALPHABET, auto: true, word: "AB", ...patch });
const prize = (p: Record<string, unknown>) => ({ id: "new-1", label: "보너스", points: 0, weight: 1, ...p });

describe("알파벳 단어판 (OBS 시점)", () => {
  it("replays a board's events up to the OBS clock: a 완성 stays lit until the next letter", () => {
    const t = (sec: number) => new Date(T0.getTime() + sec * 1000).toISOString();
    const board = {
      slots: [{ letter: "A" }, { letter: "B" }].map((x) => ({ ...x, revealAt: null })),
      timeline: [
        { at: t(4), kind: "LETTER" as const, slot: 0 },
        { at: t(10), kind: "LETTER" as const, slot: 1 },
        { at: t(16), kind: "DONE" as const, slot: null },
        { at: t(22), kind: "LETTER" as const, slot: 1 },
        { at: t(25), kind: "CLEAR" as const, slot: null },
        { at: t(28), kind: "LETTER" as const, slot: 0 }
      ]
    };
    const at = (sec: number) => alphabetBoardAt(board, T0.getTime() + sec * 1000);
    expect([0, 4, 10, 16, 21, 22, 25, 28].map((s) => [at(s).lit.map(Number).join(""), at(s).done])).toEqual([
      ["00", 0],
      ["10", 0],
      ["11", 0],
      ["11", 1],
      ["11", 1],
      ["01", 1],
      ["00", 1],
      ["10", 1]
    ]);
  });
});

describe("알파벳 모으기", () => {
  beforeEach(() => {
    resetMockStores();
    rolls.length = 0;
    vi.useFakeTimers({ now: T0, toFake: ["Date"] });
  });
  afterEach(() => vi.useRealTimers());

  it("validates and saves the settings", async () => {
    const m = await load();
    const prizes = [prize({ label: " 보너스 ", points: 1_000, weight: 1 }), prize({ id: "new-2", label: "애교", weight: 3 })];
    expect(await m.saveAlphabet(settings({ word: " lucky ", missPercent: 30, theme: "ARCADE", prizes: prizes as AlphabetSettings["prizes"] }))).toEqual({ status: "SAVED" });
    const saved = (await m.getGamesView())!.alphabetSettings;
    expect(saved).toMatchObject({ word: "LUCKY", missPercent: 30, theme: "ARCADE" });
    expect(saved.prizes.map((p) => [p.label, p.points, p.weight])).toEqual([
      ["보너스", 1_000, 1],
      ["애교", 0, 3]
    ]);
    // New 상품 get a server id; a saved id is kept.
    expect(saved.prizes.every((p) => p.id.startsWith("ap-"))).toBe(true);
    expect(await m.saveAlphabet({ ...saved, prizes: saved.prizes.slice(1) })).toEqual({ status: "SAVED" });
    expect((await m.getGamesView())!.alphabetSettings.prizes.map((p) => p.id)).toEqual([saved.prizes[1].id]);

    const bad: [Record<string, unknown>, string][] = [
      [{ word: "A" }, "영문 알파벳 2 ~ 12자"],
      [{ word: "ABCDEFGHIJKLM" }, "영문 알파벳 2 ~ 12자"],
      [{ word: "AB1" }, "영문 알파벳 2 ~ 12자"],
      [{ word: "가나" }, "영문 알파벳 2 ~ 12자"],
      [{ word: "A B" }, "영문 알파벳 2 ~ 12자"],
      [{ word: "admin" }, "사용할 수 없는 단어"],
      [{ missPercent: 91 }, "꽝 비율은 0 ~ 90%"],
      [{ missPercent: 1.5 }, "꽝 비율은"],
      [{ theme: "PINK" }, "단어판 테마"],
      [{ prizes: Array.from({ length: 13 }, () => prize({})) }, "상품은 12개까지"],
      [{ prizes: [prize({ label: " " })] }, "상품 문구는 1~20자"],
      [{ prizes: [prize({ label: "가".repeat(21) })] }, "상품 문구는 1~20자"],
      [{ prizes: [prize({ label: "운영자 상품" })] }, "사용할 수 없는 단어"],
      [{ prizes: [prize({ points: -1 })] }, "상품 점수는 0 ~ 10,000,000점"],
      [{ prizes: [prize({ weight: 0 })] }, "상품 가중치는 1 ~ 1000"],
      [{ prizes: [prize({ weight: 1001 })] }, "상품 가중치는"],
      [{ excluded: ["sig-nope"] }, "제외할 시그니처"]
    ];
    for (const [patch, message] of bad) {
      const res = await m.saveAlphabet(settings(patch as Partial<AlphabetSettings>));
      expect(res.status === "INVALID" && res.message, message).toContain(message);
    }
    signIn(["SUPPORTER"]);
    expect(await m.saveAlphabet(settings())).toEqual({ status: "UNAUTHORIZED" });
  });

  it("a 시그니처 후원 to a member spins a letter or 꽝; a completed word draws a 상품 and starts over", async () => {
    const m = await load();
    const id = await m.start();
    await m.saveAlphabet(settings({ prizes: [prize({ points: 1_000, weight: 1 }), prize({ id: "new-2", label: "애교", weight: 3 })] as AlphabetSettings["prizes"] }));
    // The reel of "AB" at 꽝 50%: rolls 0 ~ 49 → A, 50 ~ 99 → B, 100 ~ 199 → 꽝.
    rolls.push(0);
    await m.sign("cm-s2");
    expect(await m.filled("cm-s2")).toBe("A_");
    rolls.push(150);
    await m.sign("cm-s2");
    rolls.push(10);
    await m.sign("cm-s2"); // A again: no slot left for it
    expect(await m.filled("cm-s2")).toBe("A_");
    rolls.push(60, 0); // B completes the word; the 상품 roll 0 → 보너스 (가중치 1 of 4)
    await m.sign("cm-s2");
    expect(m.runs(id).map((r) => [r.memberId, r.label, r.kind, r.itemId, r.points])).toEqual([
      ["cm-s2", "A", "TEXT", "A", 0],
      ["cm-s2", "꽝", "MISS", null, 0],
      ["cm-s2", "A (중복)", "TEXT", "A", 0],
      ["cm-s2", "B", "TEXT", "B", 0],
      ["cm-s2", "단어 완성! 보너스", "ADD", expect.stringMatching(/^ap-/), 1_000]
    ]);
    expect(m.runs(id)[4].id).toBe(`${m.runs(id)[3].id}-done`);
    expect(await m.board("cm-s2")).toMatchObject({ name: "하늘", done: 1 });
    expect(await m.filled("cm-s2")).toBe("AB"); // the completed word stays until the next letter
    // The letters show with their runs; the 상품 counts once the 완성 shows.
    expect((await m.board("cm-s2")).slots[1].revealAt).toBe(m.runs(id)[3].revealAt);
    expect(await m.gamePoints("cm-s2")).toBe(0);
    vi.setSystemTime(at(120));
    expect(await m.gamePoints("cm-s2")).toBe(1_000);

    rolls.push(60);
    await m.sign("cm-s2");
    expect(await m.filled("cm-s2")).toBe("_B");
    expect((await m.board("cm-s2")).done).toBe(1);
    // OBS replays the board: the word stays complete until this B shows.
    const b2 = await m.board("cm-s2");
    expect(b2.timeline.map((e) => [e.kind, e.slot])).toEqual([
      ["LETTER", 0],
      ["LETTER", 1],
      ["DONE", null],
      ["LETTER", 1]
    ]);
    expect(alphabetBoardAt(b2, Date.parse(b2.timeline[3].at) - 1).lit).toEqual([true, true]);
    expect(alphabetBoardAt(b2, Date.parse(b2.timeline[3].at)).lit).toEqual([false, true]);
    // Another member collects their own; a donation without a member spins nothing.
    rolls.push(0);
    await m.sign("cm-s3");
    expect(await m.filled("cm-s3")).toBe("A_");
    const before = m.runs(id).length;
    await m.sign();
    // Off, or an excluded signature: no spin.
    await m.saveAlphabet(settings({ auto: false }));
    await m.sign("cm-s2");
    await m.saveAlphabet(settings({ excluded: [m.a.id] }));
    await m.sign("cm-s2");
    expect(m.runs(id)).toHaveLength(before);
    await m.sign("cm-s2", m.b);
    expect(m.runs(id)).toHaveLength(before + 1);
  });

  it("a word with repeated letters needs each of them; another word starts over", async () => {
    const m = await load();
    const id = await m.start();
    await m.saveAlphabet(settings({ word: "AAB", missPercent: 0 }));
    // "AAB" without 꽝: A or B evenly — rolls 0 ~ 99 → A, 100 ~ 199 → B.
    rolls.push(0, 0, 150);
    for (let i = 0; i < 3; i++) await m.sign("cm-s1");
    expect(await m.filled("cm-s1")).toBe("AAB");
    expect(m.runs(id).at(-1)).toMatchObject({ label: "단어 완성!", kind: "TEXT", points: 0 }); // no 상품
    const view = await m.view();
    expect(view.letters).toEqual(["A", "B"]);
    expect(view.boards.map((x) => x.name)).toEqual(["길동", "하늘", "바다"]);
    const obs = await m.getOverlayScoreboard(m.overlayKey);
    expect(obs !== "IDLE" && obs !== "FORBIDDEN" && obs.alphabet.boards[0].done).toBe(1);

    await m.saveAlphabet(settings({ word: "CAB", missPercent: 0 }));
    expect(await m.filled("cm-s1")).toBe("___");
    expect((await m.board("cm-s1")).done).toBe(0);
  });

  it("lets the operator spin by hand and empty the boards", async () => {
    const m = await load();
    const id = await m.start();
    const play = (requestId: string, memberId = "cm-s2") => m.playGame({ game: "ALPHABET", broadcastId: id, requestId, memberId, sourceId: null });
    expect(await play(key(1))).toEqual({ status: "INVALID", message: "먼저 알파벳 모으기 단어를 정해 주세요." });
    await m.saveAlphabet(settings({ missPercent: 0 }));
    rolls.push(0);
    const res = await play(key(2));
    expect(res).toMatchObject({ status: "PLAYED", run: { memberName: "하늘", label: "A", trigger: { kind: "MANUAL" } } });
    expect(await play(key(2))).toEqual(res); // retried: the same spin
    expect(m.runs(id)).toHaveLength(1);
    rolls.push(0);
    await play(key(3), "cm-s3");

    const reset = (memberId: unknown) => m.resetAlphabet({ broadcastId: id, memberId });
    rolls.push(150);
    await play(key(4)); // B completes 하늘's word
    expect(await m.board("cm-s2")).toMatchObject({ done: 1 });
    expect(await reset("cm-s2")).toEqual({ status: "SAVED" });
    expect([await m.filled("cm-s2"), await m.filled("cm-s3")]).toEqual(["__", "A_"]);
    expect((await m.board("cm-s2")).done).toBe(1); // the 완성 count stays
    expect(await reset(null)).toEqual({ status: "SAVED" });
    expect(await m.filled("cm-s3")).toBe("__");
    expect((await m.board("cm-s2")).done).toBe(0);
    expect(await reset(3)).toEqual({ status: "INVALID", message: "멤버를 다시 골라 주세요." });
    expect(await m.resetAlphabet({ broadcastId: "bc-x", memberId: null })).toEqual({ status: "INVALID", message: "진행 중인 방송이 아니에요." });
    signIn(["SUPPORTER"]);
    expect(await reset(null)).toEqual({ status: "UNAUTHORIZED" });
  });
});
