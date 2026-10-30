import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import { DEFAULT_SIG_DOSAN, type SigDosanSettings } from "./crewTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 시그니처 두산 (2026-10-24, StreamDonate 시그니처 두산 참고) on the 점수 게임 engine. */
async function load() {
  const bc = await import("./crewBroadcast");
  const games = await import("./crewGames");
  const core = await import("./crewSigDosanCore");
  const { mockCrew } = await import("./mockCrewStore");
  const { mockCreator } = await import("@/services/creator/mockCreatorStore");
  const { mockAccount } = await import("@/services/account/mockStore");
  const { mockSignatures } = await import("@/services/donations/signatureCore");
  const { requestDonation } = await import("@/services/donations/donate");
  const signatures = await import("@/services/donations/signatures");
  // The session's donations go to the studio channel (its crew and live broadcast).
  const creators = await import("@/services/creators/creators");
  const c1 = (await creators.getCreatorById("c1"))!;
  vi.spyOn(creators, "getCreatorById").mockResolvedValue({ ...c1, id: "studio" });
  mockAccount.fnBalance = 10_000_000;
  const all = (await signatures.listSignatures())!;
  // The three cheapest, the lowest first: the ladder of a 두산 picked in any order.
  const [s1, s2, s3] = [...all].sort((x, y) => x.price - y.price);
  let n = 0;
  const sign = (s: { id: string; price: number }, memberId?: string) =>
    requestDonation({ creatorId: "studio", hideProfile: false, type: "SIGNATURE", signatureId: s.id, message: "", amount: s.price, expectedAmount: s.price, idempotencyKey: key(++n), memberId });
  // The seed attributions are stamped when the store is made (T0): the broadcast starts a second later.
  const start = async (teams?: Record<string, "A" | "B">) => {
    vi.setSystemTime(at(1));
    expect(await bc.startBroadcast({ requestId: crypto.randomUUID(), title: "두산 방송", teamMode: !!teams, teams })).toEqual({ status: "SAVED" });
    return (await bc.getBroadcastView())!.live!.id;
  };
  const view = async () => (await games.getGamesView())!.live!.sigDosan;
  const obs = async () => {
    const overlay = await bc.getOverlayScoreboard(mockCreator.integrationKey);
    if (overlay === "IDLE" || overlay === "FORBIDDEN") throw new Error("no live overlay");
    return overlay.sigDosan;
  };
  const runs = (id: string) => (mockCrew.broadcasts!.find((x) => x.id === id)!.gameRuns ?? []).filter((r) => r.game === "SIG_DOSAN");
  const climbed = async () => Object.fromEntries((await view()).board!.lanes.map((l) => [l.key, l.steps.length]));
  const gamePoints = async (memberId: string) => (await bc.getBroadcastView())!.live!.rows.find((r) => r.memberId === memberId)!.game;
  return { ...bc, ...games, core, mockCrew, mockSignatures, all, s1, s2, s3, sign, start, view, obs, runs, climbed, gamePoints };
}

const T0 = new Date("2026-10-24T12:00:00Z");
const at = (sec: number) => new Date(T0.getTime() + sec * 1000);
const settings = (patch: Partial<SigDosanSettings> = {}) => ({ ...DEFAULT_SIG_DOSAN, auto: true, ...patch });

describe("시그니처 두산", () => {
  beforeEach(() => {
    resetMockStores();
    vi.useFakeTimers({ now: T0, toFake: ["Date"] });
  });
  afterEach(() => vi.useRealTimers());

  it("validates and saves the settings", async () => {
    const m = await load();
    expect(await m.saveSigDosan(settings({ mode: "VS", signatureIds: [m.s3.id, m.s1.id, m.s3.id], bonus: 5_000 }))).toEqual({ status: "SAVED" });
    expect((await m.getGamesView())!.sigDosanSettings).toMatchObject({ mode: "VS", signatureIds: [m.s3.id, m.s1.id], bonus: 5_000, display: "ROLLER" });
    const bad: [Record<string, unknown>, string][] = [
      [{ mode: "TEAM" }, "설정을 확인"],
      [{ signatureIds: ["sig-nope"] }, "두산 시그니처를 확인"],
      [{ signatureIds: "all" }, "두산 시그니처를 확인"],
      [{ bonus: -1 }, "완주 보너스는 0 ~ 10,000,000점"],
      [{ bonus: 0.5 }, "완주 보너스는"],
      [{ display: "SLIDE" } as never, "OBS 표시 방식을 골라"],
      [{ excluded: ["sig-nope"] }, "제외할 시그니처"]
    ];
    for (const [patch, message] of bad) {
      const res = await m.saveSigDosan(settings(patch as Partial<SigDosanSettings>));
      expect(res.status === "INVALID" && res.message, message).toContain(message);
    }
    const ids = Array.from({ length: 21 }, (_, i) => `sig-${i}`);
    expect(m.core.parseSigDosanSettings(settings({ signatureIds: ids }), [], ids)).toEqual({ message: "두산 시그니처는 20개까지 고를 수 있어요." });
    expect(m.core.parseSigDosanSettings(settings({ signatureIds: ids.slice(1) }), [], ids)).toMatchObject({ signatureIds: ids.slice(1) });
    // OBS 표시 방식 (2026-10-30): 사다리 kept; a screen from before sends none (롤러), and settings saved before read with it.
    expect(await m.saveSigDosan(settings({ display: "LADDER" }))).toEqual({ status: "SAVED" });
    expect((await m.getGamesView())!.sigDosanSettings.display).toBe("LADDER");
    const older: Partial<SigDosanSettings> = settings();
    delete older.display;
    expect(m.core.parseSigDosanSettings(older, [], [])).toMatchObject({ display: "ROLLER" });
    m.mockCrew.sigDosans!.studio = older as SigDosanSettings;
    expect((await m.getGamesView())!.sigDosanSettings.display).toBe("ROLLER");
    signIn(["SUPPORTER"]);
    expect(await m.saveSigDosan(settings())).toEqual({ status: "UNAUTHORIZED" });
  });

  it("lines the picked signatures up from the lowest price; VS needs a team broadcast", async () => {
    const m = await load();
    expect(await m.startSigDosan({ broadcastId: "bc-x", requestId: key(1) })).toEqual({ status: "INVALID", message: "진행 중인 방송이 아니에요." });
    const id = await m.start();
    const tooFew = { status: "INVALID", message: "두산에 쓸 시그니처를 2개 이상 골라 주세요(사용 중인 시그니처만 들어가요)." };
    expect(await m.startSigDosan({ broadcastId: id, requestId: key(1) })).toEqual(tooFew);
    // A hidden signature stays off the ladder.
    m.mockSignatures.items.find((x) => x.id === m.s2.id)!.active = false;
    await m.saveSigDosan(settings({ signatureIds: [m.s3.id, m.s2.id] }));
    expect(await m.startSigDosan({ broadcastId: id, requestId: key(1) })).toEqual(tooFew);
    m.mockSignatures.items.find((x) => x.id === m.s2.id)!.active = true;
    expect(await m.startSigDosan({ broadcastId: id, requestId: key(2) })).toEqual({ status: "SAVED" });
    await m.saveSigDosan(settings({ signatureIds: [m.s3.id, m.s1.id, m.s2.id] }));
    expect(await m.startSigDosan({ broadcastId: id, requestId: key(3) })).toEqual({ status: "SAVED" });
    const board = (await m.view()).board!;
    expect(board.ladder.map((x) => [x.signatureId, x.price])).toEqual([m.s1, m.s2, m.s3].map((s) => [s.id, s.price]));
    expect(board.ladder[0].imageUrl).toEqual(expect.any(String));
    expect(board).toMatchObject({ mode: "ALL", winner: null, lanes: [{ key: "ALL", label: "전체", color: null, steps: [] }] });
    expect((await m.obs()).board!.ladder).toHaveLength(3);
    expect(await m.startSigDosan({ broadcastId: id, requestId: key(3) })).toEqual({ status: "SAVED" }); // retried: same board
    expect((await m.view()).board!.startedAt).toBe(board.startedAt);

    await m.saveSigDosan(settings({ mode: "VS", signatureIds: [m.s1.id, m.s2.id] }));
    expect(await m.startSigDosan({ broadcastId: id, requestId: key(4) })).toEqual({ status: "INVALID", message: "VS는 팀 배틀 방송에서만 할 수 있어요." });
    expect(await m.playGame({ game: "SIG_DOSAN", broadcastId: id, requestId: key(5), memberId: "cm-s2" })).toEqual({
      status: "INVALID",
      message: "시그니처 두산은 시그니처 후원이나 한 단 올리기로 올라가요."
    });
    expect(await m.clearSigDosan({ broadcastId: id })).toEqual({ status: "SAVED" });
    expect((await m.view()).board).toBeNull();
    signIn(["SUPPORTER"]);
    expect(await m.startSigDosan({ broadcastId: id, requestId: key(6) })).toEqual({ status: "UNAUTHORIZED" });
  });

  it("전체: the next step's 시그니처 후원 climbs the crew's lane; the last one finishes with the 완주 보너스", async () => {
    const m = await load();
    const id = await m.start();
    await m.saveSigDosan(settings({ signatureIds: [m.s1.id, m.s2.id, m.s3.id], bonus: 3_000 }));
    await m.startSigDosan({ broadcastId: id, requestId: key(1) });
    await m.sign(m.s2, "cm-s2"); // not the next step
    await m.sign(m.s1); // no member: climbs, no one to credit
    await m.sign(m.s2, "cm-s2");
    expect(await m.climbed()).toEqual({ ALL: 2 });
    await m.sign(m.s3, "cm-s3");
    expect(m.runs(id).map((r) => [r.memberId, r.label, r.kind, r.points, r.itemId])).toEqual([
      ["", `1단 · ${m.s1.name}`, "TEXT", 0, m.s1.id],
      ["cm-s2", `2단 · ${m.s2.name}`, "TEXT", 0, m.s2.id],
      ["cm-s3", "완주!", "ADD", 3_000, m.s3.id]
    ]);
    const board = (await m.view()).board!;
    expect(board.lanes[0].steps.map((x) => [x.memberName, x.manual])).toEqual([
      [null, false],
      ["하늘", false],
      ["바다", false]
    ]);
    expect(board.winner).toMatchObject({ lane: "ALL", label: "전체", memberName: "바다", revealAt: m.runs(id)[2].revealAt });
    // Won: nothing climbs; the bonus counts once the 완주 shows.
    await m.sign(m.s1, "cm-s2");
    expect(m.runs(id)).toHaveLength(3);
    expect(await m.gamePoints("cm-s3")).toBe(0);
    vi.setSystemTime(at(120));
    expect(await m.gamePoints("cm-s3")).toBe(3_000);

    // Off: nothing climbs.
    await m.saveSigDosan(settings({ signatureIds: [m.s1.id, m.s2.id], auto: false }));
    await m.startSigDosan({ broadcastId: id, requestId: key(2) });
    await m.sign(m.s1, "cm-s2");
    expect(await m.climbed()).toEqual({ ALL: 0 });
  });

  it("VS: each team climbs its own lane; the first to the top wins", async () => {
    const m = await load();
    const id = await m.start({ "cm-s1": "A", "cm-s2": "B" });
    await m.saveSigDosan(settings({ mode: "VS", signatureIds: [m.s1.id, m.s2.id], bonus: 1_000 }));
    expect(await m.startSigDosan({ broadcastId: id, requestId: key(1) })).toEqual({ status: "SAVED" });
    await m.sign(m.s1, "cm-s1");
    await m.sign(m.s1, "cm-s3"); // no team
    await m.sign(m.s1); // no member
    await m.sign(m.s1, "cm-s2");
    expect(await m.climbed()).toEqual({ A: 1, B: 1 });
    await m.sign(m.s2, "cm-s2");
    await m.sign(m.s2, "cm-s1"); // B팀 already won
    expect(m.runs(id).map((r) => [r.memberId, r.label, r.points])).toEqual([
      ["cm-s1", `A팀 1단 · ${m.s1.name}`, 0],
      ["cm-s2", `B팀 1단 · ${m.s1.name}`, 0],
      ["cm-s2", "B팀 완주! 승리", 1_000]
    ]);
    const board = (await m.obs()).board!;
    expect(board.lanes.map((l) => [l.key, l.label, l.steps.length])).toEqual([
      ["A", "A팀", 1],
      ["B", "B팀", 2]
    ]);
    expect(board.winner).toMatchObject({ lane: "B", label: "B팀", memberName: "하늘" });
  });

  it("개인전: each member climbs their own lane", async () => {
    const m = await load();
    const id = await m.start();
    await m.saveSigDosan(settings({ mode: "SOLO", signatureIds: [m.s1.id, m.s2.id] }));
    await m.startSigDosan({ broadcastId: id, requestId: key(1) });
    const lanes = (await m.view()).board!.lanes;
    expect(lanes.map((l) => [l.key, l.label])).toEqual([
      ["cm-s1", "길동"],
      ["cm-s2", "하늘"],
      ["cm-s3", "바다"]
    ]);
    expect(lanes[1].color).toEqual(expect.any(String));
    await m.sign(m.s1); // no member: no lane
    await m.sign(m.s1, "cm-s2");
    await m.sign(m.s1, "cm-s3");
    await m.sign(m.s2, "cm-s3");
    expect(await m.climbed()).toEqual({ "cm-s1": 0, "cm-s2": 1, "cm-s3": 2 });
    expect(m.runs(id).at(-1)).toMatchObject({ memberId: "cm-s3", label: "완주! 1등", kind: "TEXT", points: 0 }); // 보너스 0
    expect((await m.view()).board!.winner).toMatchObject({ lane: "cm-s3", label: "바다", memberName: "바다" });
  });

  it("lets the operator move a lane up or down a step", async () => {
    const m = await load();
    const id = await m.start({ "cm-s1": "A", "cm-s2": "B" });
    const step = (lane: unknown, up: unknown, extra: { requestId?: string; memberId?: string | null; count?: number } = {}) =>
      m.stepSigDosan({ broadcastId: id, lane, up, requestId: extra.requestId ?? key(99), memberId: extra.memberId ?? null, count: extra.count });
    expect(await step("A", true)).toEqual({ status: "INVALID", message: "두산을 먼저 시작해 주세요." });
    await m.saveSigDosan(settings({ mode: "VS", signatureIds: [m.s1.id, m.s2.id, m.s3.id], bonus: 500 }));
    await m.startSigDosan({ broadcastId: id, requestId: key(1) });
    expect(await step("A", true, { requestId: key(2), memberId: "cm-s1" })).toEqual({ status: "SAVED" });
    expect(await step("A", true, { requestId: key(2), memberId: "cm-s1" })).toEqual({ status: "SAVED" }); // retried: no further
    expect(m.runs(id).map((r) => [r.memberId, r.label, r.trigger])).toEqual([["cm-s1", `A팀 1단 · ${m.s1.name}`, { kind: "MANUAL" }]]);
    expect(await step("A", true, { requestId: key(3), memberId: "cm-s2" })).toEqual({ status: "INVALID", message: "A팀 멤버를 골라 주세요." });
    expect(await step("B", true, { requestId: key(4) })).toEqual({ status: "SAVED" }); // no member
    for (const bad of ["C", "ALL", 1]) expect(await step(bad, true)).toEqual({ status: "INVALID", message: "줄을 다시 골라 주세요." });
    expect(await step("A", "yes")).toEqual({ status: "INVALID", message: "줄을 다시 골라 주세요." });

    expect(await step("A", false, { count: 1 })).toEqual({ status: "SAVED" });
    expect(await step("A", false, { count: 1 })).toEqual({ status: "SAVED" }); // retried: A is at 0 now
    expect(await m.climbed()).toEqual({ A: 0, B: 1 });
    expect((await m.view()).board!.lanes[1].steps[0]).toMatchObject({ memberName: null, manual: true });
    await step("B", true, { requestId: key(5), memberId: "cm-s2" });
    await step("B", true, { requestId: key(6), memberId: "cm-s2" });
    expect(m.runs(id).at(-1)).toMatchObject({ memberId: "cm-s2", label: "B팀 완주! 승리", points: 500, trigger: { kind: "MANUAL" } });
    expect(await step("A", true, { requestId: key(7) })).toEqual({ status: "INVALID", message: "이미 완주했어요. 처음부터 다시 시작해 주세요." });
    expect(await step("B", false, { count: 3 })).toEqual({ status: "INVALID", message: "완주한 판은 되돌릴 수 없어요." });
    signIn(["SUPPORTER"]);
    expect(await step("A", true, { requestId: key(8) })).toEqual({ status: "UNAUTHORIZED" });
  });

  it("개인전: only an active member's lane moves by hand", async () => {
    const m = await load();
    const id = await m.start();
    await m.saveSigDosan(settings({ mode: "SOLO", signatureIds: [m.s1.id, m.s2.id] }));
    await m.startSigDosan({ broadcastId: id, requestId: key(1) });
    expect(await m.stepSigDosan({ broadcastId: id, lane: "cm-s4", up: true, requestId: key(2), memberId: null })).toEqual({ status: "INVALID", message: "줄을 다시 골라 주세요." }); // 휴식
    expect(await m.stepSigDosan({ broadcastId: id, lane: "cm-s2", up: true, requestId: key(3), memberId: "cm-s3" })).toEqual({ status: "SAVED" });
    expect(m.runs(id).at(-1)).toMatchObject({ memberId: "cm-s2" }); // the lane's own member
  });
});
