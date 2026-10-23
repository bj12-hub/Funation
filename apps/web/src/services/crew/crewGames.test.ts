import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import { DEFAULT_SPIN, type SpinItem, type SpinSettings } from "./crewTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 점수 게임 (2026-10-23, StreamDonate 참고, P2): the shared engine and 스핀머신. */
async function load() {
  const bc = await import("./crewBroadcast");
  const games = await import("./crewGames");
  const engine = await import("./crewGameCore");
  const battle = await import("./crewBattle");
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
  const text = (amount: number, memberId?: string) =>
    requestDonation({ creatorId: "studio", hideProfile: false, type: "TEXT", amount, message: "응원", voiceId: null, idempotencyKey: key(++n), memberId });
  // The seed attributions are stamped when the store is made (T0): the broadcast starts a second later.
  const start = async () => {
    vi.setSystemTime(at(1));
    expect(await bc.startBroadcast({ requestId: crypto.randomUUID(), title: "게임 방송", teamMode: false })).toEqual({ status: "SAVED" });
    return (await bc.getBroadcastView())!.live!.id;
  };
  return { ...bc, ...games, ...engine, ...battle, signatures, mockCrew, a, b, sign, text, start, overlayKey: mockCreator.integrationKey };
}

const item = (patch: Partial<SpinItem> = {}): SpinItem => ({ id: "x", label: "×2", kind: "MULTIPLY", value: 2, weight: 1, ...patch });
const settings = (patch: Partial<SpinSettings> = {}) => ({ ...DEFAULT_SPIN, items: [item()], ...patch });
const T0 = new Date("2026-10-23T12:00:00Z");
const at = (sec: number) => new Date(T0.getTime() + sec * 1000);
const row = async (m: Awaited<ReturnType<typeof load>>, memberId: string) => (await m.getBroadcastView())!.live!.rows.find((r) => r.memberId === memberId)!;

describe("점수 게임 엔진", () => {
  it("draws by weight on the server", async () => {
    const { drawIndex } = await import("./crewGameCore");
    expect(drawIndex([5])).toBe(0);
    const hits = Array.from({ length: 4000 }, () => drawIndex([3, 1])).filter((i) => i === 0).length;
    expect(hits / 4000).toBeGreaterThan(0.7);
    expect(hits / 4000).toBeLessThan(0.8);
  });
});

describe("스핀머신", () => {
  beforeEach(() => {
    resetMockStores();
    vi.useFakeTimers({ now: T0, toFake: ["Date"] });
  });
  afterEach(() => vi.useRealTimers());

  it("validates and saves the settings, keeping saved item ids", async () => {
    const m = await load();
    expect(await m.saveSpinMachine(settings({ title: " 대박 머신 ", items: [item({ id: "new-1", label: " ×1.5 ", value: 1.5 }), item({ id: "new-2", label: "애교", kind: "TEXT", value: 99 })], excluded: [m.a.id, m.a.id] }))).toEqual({ status: "SAVED" });
    const saved = (await m.getGamesView())!.spinSettings;
    expect(saved).toMatchObject({ title: "대박 머신", excluded: [m.a.id], items: [{ label: "×1.5", kind: "MULTIPLY", value: 1.5 }, { label: "애교", kind: "TEXT", value: 0 }] });
    expect(saved.items[0].id).toMatch(/^sp-/);
    // Saved ids are kept; a made-up one is replaced.
    await m.saveSpinMachine({ ...saved, items: [...saved.items, item({ id: saved.items[0].id, label: "중복" })] });
    const again = (await m.getGamesView())!.spinSettings.items;
    expect(again.slice(0, 2).map((i) => i.id)).toEqual(saved.items.map((i) => i.id));
    expect(again[2].id).not.toBe(saved.items[0].id);

    const bad: [Record<string, unknown>, string][] = [
      [{ title: "가".repeat(21) }, "제목"],
      [{ items: Array.from({ length: 13 }, () => item()) }, "12개"],
      [{ items: [item({ label: "" })] }, "칸 이름"],
      [{ items: [item({ label: "가".repeat(13) })] }, "칸 이름"],
      [{ items: [item({ weight: 0 })] }, "가중치"],
      [{ items: [item({ weight: 101 })] }, "가중치"],
      [{ items: [item({ value: 1 })] }, "배수"],
      [{ items: [item({ value: 10.5 })] }, "배수"],
      [{ items: [item({ value: 1.234 })] }, "배수"],
      [{ items: [item({ kind: "ADD", value: 0 })] }, "더할 점수"],
      [{ items: [item({ kind: "JACKPOT" as never })] }, "칸 종류"],
      [{ items: [item({ label: "운영자 칸" })] }, "사용할 수 없는"],
      [{ excluded: ["sig-nope"] }, "제외할 시그니처"],
      [{ auto: "yes" }, "설정"],
      [{ showIdle: 1 }, "설정"]
    ];
    for (const [patch, message] of bad) {
      const res = await m.saveSpinMachine(settings(patch as Partial<SpinSettings>));
      expect(res.status === "INVALID" && res.message, message).toContain(message);
    }
    signIn(["SUPPORTER"]);
    expect(await m.saveSpinMachine(settings())).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.getGamesView()).toBeNull();
  });

  it("spins once per 시그니처 후원 to a member, queues the runs on OBS and counts a result once it shows", async () => {
    const m = await load();
    const id = await m.start();
    await m.saveSpinMachine(settings({ auto: true, excluded: [m.b.id] }));

    await m.sign(m.a.id, m.a.price, "cm-s2");
    const runs = () => m.mockCrew.broadcasts!.find((x) => x.id === id)!.gameRuns ?? [];
    expect(runs()).toHaveLength(1);
    const first = runs()[0];
    expect(first).toMatchObject({ game: "SPIN", memberId: "cm-s2", sourceId: expect.any(String), basePoints: m.a.price, points: m.a.price, trigger: { kind: "SIGNATURE", signatureName: m.a.name } });
    // OBS: starts after the lead time, the result shows when the reel stops.
    expect(first.showAt).toBe(at(4).toISOString());
    expect(first.revealAt).toBe(at(8).toISOString());

    // No spin: an excluded signature, no member picked, a 일반 후원 that is no signature.
    await m.sign(m.b.id, m.b.price, "cm-s3");
    await m.sign(m.a.id, m.a.price);
    await m.text(m.a.price + 1, "cm-s3");
    expect(runs()).toHaveLength(1);
    // A 일반 후원 matched to a signature by 금액 일치 spins too; it queues after the first run.
    await m.signatures.saveSignature({ ...m.a, match: "AMOUNT" });
    await m.text(m.a.price, "cm-s3");
    expect(runs()).toHaveLength(2);
    expect(runs()[1]).toMatchObject({ memberId: "cm-s3", showAt: at(12).toISOString(), revealAt: at(16).toISOString() });

    // The ×2 counts on the boards only once the reel stopped.
    expect(await row(m, "cm-s2")).toMatchObject({ donated: m.a.price, game: 0, score: m.a.price });
    vi.setSystemTime(at(8));
    expect(await row(m, "cm-s2")).toMatchObject({ game: m.a.price, score: m.a.price * 2 });
    const live = (await m.getBroadcastView())!.live!;
    expect(live.spin.runs.map((r) => r.memberName)).toEqual(["바다", "하늘"]);
    const overlay = await m.getOverlayScoreboard(m.overlayKey);
    expect(overlay !== "IDLE" && overlay !== "FORBIDDEN" && overlay.spin.runs).toHaveLength(2);

    // 방송 종료: every run counts in the final ranking (the second result was still spinning).
    await m.endBroadcast(id);
    const ended = m.mockCrew.broadcasts!.find((x) => x.id === id)!;
    // 바다: the excluded signature, the 일반 후원 that was no signature, and the matched one with its ×2.
    expect(ended.final!.find((r) => r.memberId === "cm-s3")!.score).toBe(m.b.price + (m.a.price + 1) + m.a.price * 2);
    // No live broadcast: no spin.
    await m.sign(m.a.id, m.a.price, "cm-s2");
    expect(ended.gameRuns).toHaveLength(2);
  });

  it("does not spin while 자동 스핀 is off or the reel is empty", async () => {
    const m = await load();
    const id = await m.start();
    await m.saveSpinMachine(settings({ auto: false }));
    await m.sign(m.a.id, m.a.price, "cm-s2");
    await m.saveSpinMachine(settings({ auto: true, items: [] }));
    await m.sign(m.a.id, m.a.price, "cm-s2");
    expect(m.mockCrew.broadcasts!.find((x) => x.id === id)!.gameRuns ?? []).toEqual([]);
  });

  it("spins by hand on a member's donation (once per donation) or on none", async () => {
    const m = await load();
    const id = await m.start();
    await m.saveSpinMachine(settings({ items: [item({ kind: "ADD", label: "+500", value: 500 })] }));
    await m.sign(m.a.id, m.a.price, "cm-s2");
    const sources = (await m.getGamesView())!.live!.sources["cm-s2"];
    expect(sources).toEqual([{ id: expect.any(String), at: at(1).toISOString(), label: "홍길동", points: m.a.price }]);

    const spin = (requestId: string, extra: Record<string, unknown> = {}) => m.spinMachine({ broadcastId: id, requestId, memberId: "cm-s2", sourceId: sources[0].id, ...extra });
    const res = await spin(key(1));
    expect(res).toMatchObject({ status: "SPUN", run: { memberName: "하늘", label: "+500", points: 500, basePoints: m.a.price, trigger: { kind: "MANUAL" } } });
    expect(await spin(key(1))).toEqual(res); // retried: the same run
    expect(await spin(key(2))).toEqual({ status: "INVALID", message: "이미 스핀을 돌린 후원이에요." });
    expect((await m.getGamesView())!.live!.sources["cm-s2"]).toEqual([]);
    expect(await spin(key(3), { sourceId: "dn-nope" })).toEqual({ status: "INVALID", message: "기준 후원을 다시 골라 주세요." });
    // Another member's donation is not this member's 기준 후원.
    expect(await spin(key(4), { memberId: "cm-s3" })).toEqual({ status: "INVALID", message: "기준 후원을 다시 골라 주세요." });
    expect(await spin(key(5), { sourceId: null })).toMatchObject({ status: "SPUN", run: { basePoints: 0, points: 500 } });

    expect(await spin(key(6), { memberId: "cm-s4", sourceId: null })).toEqual({ status: "INVALID", message: "돌릴 멤버를 골라 주세요." }); // inactive
    expect((await spin("short")).status).toBe("INVALID");
    expect(await m.spinMachine({ broadcastId: "bc-x", requestId: key(7), memberId: "cm-s2" })).toEqual({ status: "INVALID", message: "진행 중인 방송이 아니에요." });
    await m.saveSpinMachine(settings({ items: [] }));
    expect(await spin(key(8), { sourceId: null })).toEqual({ status: "INVALID", message: "먼저 스핀머신 칸을 만들어 주세요." });
    signIn(["SUPPORTER"]);
    expect(await spin(key(9))).toEqual({ status: "UNAUTHORIZED" });
  });

  it("counts results in 서브 점수판 · 배틀 like 강탈 (no 배수) and tallies 문구 results per member", async () => {
    const m = await load();
    const id = await m.start();
    await m.saveSpinMachine(settings({ items: [item({ kind: "TEXT", label: "애교" })] }));
    await m.startBattle({ broadcastId: id, requestId: key(20), mode: "MEMBERS", memberA: "cm-s1", memberB: "cm-s2", durationSec: 600, multiplier: 2 });
    await m.spinMachine({ broadcastId: id, requestId: key(21), memberId: "cm-s1", sourceId: null });
    await m.spinMachine({ broadcastId: id, requestId: key(22), memberId: "cm-s1", sourceId: null });
    expect((await m.getBroadcastView())!.live!.spin.tally.rows).toEqual([]); // still spinning
    vi.setSystemTime(at(16));
    expect((await m.getBroadcastView())!.live!.spin.tally).toEqual({ columns: ["애교"], rows: [{ memberId: "cm-s1", name: "길동", color: "#8b5cf6", counts: [2], total: 2 }] });

    await m.saveSpinMachine(settings({ items: [item({ kind: "ADD", label: "+1,000", value: 1_000 })] }));
    await m.spinMachine({ broadcastId: id, requestId: key(23), memberId: "cm-s1", sourceId: null });
    vi.setSystemTime(at(30));
    const live = (await m.getBroadcastView())!.live!;
    expect(live.battles[0].matches[0].sides[0].score).toBe(1_000); // ×2 battle: the game result counts as it is
    expect(live.rows.find((r) => r.memberId === "cm-s1")).toMatchObject({ game: 1_000, battle: 0, score: 1_000 });
  });
});
