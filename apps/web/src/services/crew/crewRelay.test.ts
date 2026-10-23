import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import { DEFAULT_RELAY, RELAY_EXAMPLE_TIERS, relayTierFor, type RelaySettings, type RelayTier } from "./crewTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 기여도 릴레이 (2026-10-23, StreamDonate 기여도 릴레이 참고, P2) on the 점수 게임 engine. */
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
  const [a, b] = (await signatures.listSignatures())!;
  let n = 0;
  const sign = (signatureId: string, price: number, memberId?: string) =>
    requestDonation({ creatorId: "studio", hideProfile: false, type: "SIGNATURE", signatureId, message: "", amount: price, expectedAmount: price, idempotencyKey: key(++n), memberId });
  // The seed attributions are stamped when the store is made (T0): the broadcast starts a second later.
  const start = async () => {
    vi.setSystemTime(at(1));
    expect(await bc.startBroadcast({ requestId: crypto.randomUUID(), title: "릴레이 방송", teamMode: false })).toEqual({ status: "SAVED" });
    return (await bc.getBroadcastView())!.live!.id;
  };
  const runs = (id: string) => (mockCrew.broadcasts!.find((x) => x.id === id)!.gameRuns ?? []).filter((r) => r.game === "RELAY");
  const relay = async () => (await games.getGamesView())!.live!.relay;
  return { ...bc, ...games, a, b, sign, start, runs, relay, overlayKey: mockCreator.integrationKey };
}

const T0 = new Date("2026-10-23T12:00:00Z");
const at = (sec: number) => new Date(T0.getTime() + sec * 1000);
const tier = (min: number, max: number | null, multiplier: number, id = `t-${min}`): RelayTier => ({ id, min, max, multiplier });
const settings = (patch: Partial<RelaySettings> = {}) => ({ ...DEFAULT_RELAY, auto: true, memberId: "cm-s1", tiers: [tier(0, 9_999, 2), tier(10_000, null, 3)], ...patch });

describe("기여도 릴레이 구간", () => {
  it("takes the first 구간 an amount falls in (none = no effect)", () => {
    const tiers = [tier(0, 9_999, 2), tier(5_000, null, 4, "t-b"), tier(10_000, null, 3, "t-c")];
    expect(relayTierFor(tiers, 7_000)?.multiplier).toBe(2);
    expect(relayTierFor(tiers, 10_002)?.multiplier).toBe(4); // the first match wins, even with a later one
    expect(relayTierFor([tier(20_000, 29_999, 2)], 10_002)).toBeNull();
    expect(RELAY_EXAMPLE_TIERS[0]).toEqual({ min: 0, max: 49_999, multiplier: 2 });
    expect(RELAY_EXAMPLE_TIERS.at(-1)).toEqual({ min: 400_000, max: 449_999, multiplier: 10 });
  });
});

describe("기여도 릴레이", () => {
  beforeEach(() => {
    resetMockStores();
    vi.useFakeTimers({ now: T0, toFake: ["Date"] });
  });
  afterEach(() => vi.useRealTimers());

  it("validates and saves the settings", async () => {
    const m = await load();
    expect(await m.saveRelay(settings({ title: " 릴레이 " }))).toEqual({ status: "SAVED" });
    const saved = (await m.getGamesView())!.relaySettings;
    expect(saved).toMatchObject({ title: "릴레이", memberId: "cm-s1", tiers: [{ min: 0, max: 9_999, multiplier: 2 }, { min: 10_000, max: null, multiplier: 3 }] });
    expect(saved.tiers[0].id).not.toBe("t-0"); // a made-up id is replaced
    // Off, it needs neither a 트리거 BJ nor a 구간.
    expect(await m.saveRelay({ ...DEFAULT_RELAY })).toEqual({ status: "SAVED" });

    const bad: [Record<string, unknown>, string][] = [
      [{ memberId: "cm-s4" }, "트리거 BJ를 다시"], // inactive
      [{ memberId: "cm-nope" }, "트리거 BJ를 다시"],
      [{ memberId: null }, "트리거 BJ를 골라"],
      [{ tiers: [] }, "금액 구간을 하나 이상"],
      [{ tiers: Array.from({ length: 11 }, (_, i) => tier(i, null, 2, `t-${i}`)) }, "10개"],
      [{ tiers: [tier(5_000, 4_999, 2)] }, "금액 구간"],
      [{ tiers: [tier(-1, null, 2)] }, "금액 구간"],
      [{ tiers: [tier(0, 1.5, 2)] }, "금액 구간"],
      [{ tiers: [tier(0, null, 1)] }, "배수"],
      [{ tiers: [tier(0, null, 10.5)] }, "배수"],
      [{ excluded: ["sig-nope"] }, "제외할 시그니처"]
    ];
    for (const [patch, message] of bad) {
      const res = await m.saveRelay(settings(patch as Partial<RelaySettings>));
      expect(res.status === "INVALID" && res.message, message).toContain(message);
    }
    signIn(["SUPPORTER"]);
    expect(await m.saveRelay(settings())).toEqual({ status: "UNAUTHORIZED" });
  });

  it("sets the 배수 from the 트리거 BJ's 시그니처 후원 and hands it to the next one another member receives", async () => {
    const m = await load();
    const id = await m.start();
    await m.saveRelay(settings());
    await m.sign(m.a.id, m.a.price, "cm-s2"); // nothing waiting yet
    expect(m.runs(id)).toEqual([]);
    await m.sign(m.a.id, m.a.price, "cm-s1"); // 10,002 → ×3
    expect(await m.relay()).toMatchObject({ pending: { multiplier: 3, amount: m.a.price }, triggerName: "길동" });
    await m.sign(m.b.id, m.b.price, "cm-s1"); // the 트리거 BJ again: a new 배수
    expect((await m.relay()).pending).toMatchObject({ multiplier: 3, amount: m.b.price });
    await m.sign(m.a.id, m.a.price); // no member picked: not taken
    expect((await m.relay()).pending).not.toBeNull();

    await m.sign(m.a.id, m.a.price, "cm-s3");
    expect(m.runs(id)).toHaveLength(1);
    expect(m.runs(id)[0]).toMatchObject({ memberId: "cm-s3", kind: "MULTIPLY", value: 3, basePoints: m.a.price, points: m.a.price * 2, from: { memberId: "cm-s1", amount: m.b.price } });
    expect((await m.relay()).pending).toBeNull();
    await m.sign(m.a.id, m.a.price, "cm-s2"); // used up
    expect(m.runs(id)).toHaveLength(1);

    // Shown on OBS ?relay, counted once the result shows.
    expect((await m.relay()).runs[0]).toMatchObject({ label: "×3 릴레이", memberName: "바다", from: { memberName: "길동", amount: m.b.price } });
    expect((await m.getBroadcastView())!.live!.rows.find((r) => r.memberId === "cm-s3")!.game).toBe(0);
    vi.setSystemTime(at(10));
    expect((await m.getBroadcastView())!.live!.rows.find((r) => r.memberId === "cm-s3")!.game).toBe(m.a.price * 2);

    // A 트리거 후원 in no 구간 clears what was waiting.
    await m.sign(m.a.id, m.a.price, "cm-s1");
    await m.saveRelay(settings({ tiers: [tier(20_000, null, 2)] }));
    await m.sign(m.a.id, m.a.price, "cm-s1");
    expect((await m.relay()).pending).toBeNull();
  });

  it("leaves excluded signatures out and clears the waiting 배수 on request", async () => {
    const m = await load();
    const id = await m.start();
    await m.saveRelay(settings({ excluded: [m.a.id] }));
    await m.sign(m.a.id, m.a.price, "cm-s1"); // excluded: sets nothing
    expect((await m.relay()).pending).toBeNull();
    await m.sign(m.b.id, m.b.price, "cm-s1");
    await m.sign(m.a.id, m.a.price, "cm-s2"); // excluded: takes nothing
    expect((await m.relay()).pending).toMatchObject({ multiplier: 3 });
    const overlay = await m.getOverlayScoreboard(m.overlayKey);
    expect(overlay !== "IDLE" && overlay !== "FORBIDDEN" && overlay.relay.pending).toMatchObject({ multiplier: 3, amount: m.b.price });

    expect(await m.clearRelay({ broadcastId: id })).toEqual({ status: "SAVED" });
    expect((await m.relay()).pending).toBeNull();
    expect(await m.clearRelay({ broadcastId: "bc-x" })).toEqual({ status: "INVALID", message: "진행 중인 방송이 아니에요." });
    expect(await m.playGame({ game: "RELAY", broadcastId: id, requestId: key(1), memberId: "cm-s2" })).toEqual({ status: "INVALID", message: "기여도 릴레이는 시그니처 후원으로만 이어져요." });
    // Off: nothing is set.
    await m.saveRelay(settings({ auto: false }));
    await m.sign(m.b.id, m.b.price, "cm-s1");
    expect((await m.relay()).pending).toBeNull();
    signIn(["SUPPORTER"]);
    expect(await m.clearRelay({ broadcastId: id })).toEqual({ status: "UNAUTHORIZED" });
  });
});
