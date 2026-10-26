import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import { DEFAULT_RANDOM_SIG, DEFAULT_SPIN, type RandomSigSettings, type RandomSigTier } from "./crewTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 랜덤시그 (2026-10-23, StreamDonate 랜덤시그 참고, P2) on the 점수 게임 engine. */
async function load() {
  const bc = await import("./crewBroadcast");
  const games = await import("./crewGames");
  const signatures = await import("@/services/donations/signatures");
  const { mockAlerts } = await import("@/services/creator/alertCore");
  const { mockCrew } = await import("./mockCrewStore");
  const { mockCreator } = await import("@/services/creator/mockCreatorStore");
  const { mockAccount } = await import("@/services/account/mockStore");
  const { requestDonation } = await import("@/services/donations/donate");
  // The session's donations go to the studio channel (its crew, alerts and live broadcast).
  const creators = await import("@/services/creators/creators");
  const c1 = (await creators.getCreatorById("c1"))!;
  vi.spyOn(creators, "getCreatorById").mockResolvedValue({ ...c1, id: "studio" });
  mockAccount.fnBalance = 1_000_000;
  const [a, b] = (await signatures.listSignatures())!;
  let n = 0;
  const text = (amount: number, memberId?: string) =>
    requestDonation({ creatorId: "studio", hideProfile: false, type: "TEXT", amount, message: "랜덤!", voiceId: null, idempotencyKey: key(++n), memberId });
  // The seed attributions are stamped when the store is made (T0): the broadcast starts a second later.
  const start = async () => {
    vi.setSystemTime(at(1));
    expect(await bc.startBroadcast({ requestId: crypto.randomUUID(), title: "랜덤시그 방송", teamMode: false })).toEqual({ status: "SAVED" });
    return (await bc.getBroadcastView())!.live!.id;
  };
  const runs = (id: string) => mockCrew.broadcasts!.find((x) => x.id === id)!.gameRuns ?? [];
  const lastAlert = () => mockAlerts.items.at(-1)!;
  return { ...bc, ...games, signatures, a, b, text, start, runs, lastAlert, overlayKey: mockCreator.integrationKey };
}

const T0 = new Date("2026-10-23T12:00:00Z");
const at = (sec: number) => new Date(T0.getTime() + sec * 1000);
const tier = (trigger: number, min: number, max: number, id = `t-${trigger}`): RandomSigTier => ({ id, trigger, min, max });
const settings = (patch: Partial<RandomSigSettings> = {}) => ({ ...DEFAULT_RANDOM_SIG, auto: true, ...patch });

describe("랜덤시그", () => {
  beforeEach(() => {
    resetMockStores();
    vi.useFakeTimers({ now: T0, toFake: ["Date"] });
  });
  afterEach(() => vi.useRealTimers());

  it("validates the 발동 구간 and keeps the amounts a 금액 일치 signature takes", async () => {
    const m = await load();
    expect(await m.saveRandomSig(settings({ tiers: [tier(5_000, 7_000, 15_000)], mode: "REPLACE", multiplier: 1.5 }))).toEqual({ status: "SAVED" });
    const saved = (await m.getGamesView())!.randomSigSettings;
    expect(saved).toMatchObject({ auto: true, mode: "REPLACE", multiplier: 1.5, tiers: [{ trigger: 5_000, min: 7_000, max: 15_000 }] });
    // A saved tier keeps its id; a made-up one is replaced.
    await m.saveRandomSig({ ...saved, tiers: [...saved.tiers, tier(6_000, 0, 9_000, saved.tiers[0].id)] });
    const tiers = (await m.getGamesView())!.randomSigSettings.tiers;
    expect(tiers[0].id).toBe(saved.tiers[0].id);
    expect(tiers[1].id).not.toBe(saved.tiers[0].id);

    await m.signatures.saveSignature({ ...m.a, match: "AMOUNT", rangeMin: 9_000 });
    const bad: [Record<string, unknown>, string][] = [
      [{ tiers: Array.from({ length: 11 }, (_, i) => tier(1_000 + i, 0, 1)) }, "10개"],
      [{ tiers: [tier(99, 0, 1)] }, "발동 금액은"],
      [{ tiers: [tier(1.5, 0, 1)] }, "발동 금액은"],
      [{ tiers: [tier(5_000, 9_000, 8_000)] }, "시그 금액 범위"],
      [{ tiers: [tier(5_000, -1, 8_000)] }, "시그 금액 범위"],
      [{ tiers: [tier(5_000, 0, 1), tier(5_000, 2, 3, "t-2")] }, "같은 발동 금액"],
      [{ tiers: [tier(9_500, 0, 20_000)] }, `'${m.a.name}'(9,000 ~ 10,002 FN) 시그니처가 금액 일치로 받아요`],
      [{ mode: "JACKPOT" }, "기여도 방식"],
      [{ multiplier: 1 }, "기본 배수"],
      [{ multiplier: 10.5 }, "기본 배수"],
      [{ multiplier: 2.005 }, "기본 배수"],
      [{ excluded: ["sig-nope"] }, "제외할 시그니처"],
      [{ title: "운영자 랜덤" }, "사용할 수 없는"]
    ];
    for (const [patch, message] of bad) {
      const res = await m.saveRandomSig(settings(patch as Partial<RandomSigSettings>));
      expect(res.status === "INVALID" && res.message, message).toContain(message);
    }
    signIn(["SUPPORTER"]);
    expect(await m.saveRandomSig(settings())).toEqual({ status: "UNAUTHORIZED" });
  });

  it("sends a 일반 후원 of exactly a 발동 금액 as a signature drawn from the tier", async () => {
    const m = await load();
    // Only signature a is in 10,000 ~ 10,100 FN.
    await m.saveRandomSig(settings({ tiers: [tier(5_000, m.a.price, m.a.price)] }));
    await m.text(5_000);
    expect(m.lastAlert()).toMatchObject({ typeLabel: `랜덤시그 · ${m.a.name}`, signatureId: m.a.id, imageUrl: m.a.imageUrl });
    // Not a 발동 금액, or 랜덤시그 off: a 일반 후원 as before.
    await m.text(5_001);
    expect(m.lastAlert()).toMatchObject({ typeLabel: "일반 후원" });
    expect(m.lastAlert().signatureId).toBeUndefined();
    await m.saveRandomSig(settings({ auto: false, tiers: [tier(5_000, m.a.price, m.a.price)] }));
    await m.text(5_000);
    expect(m.lastAlert()).toMatchObject({ typeLabel: "일반 후원" });
    // Its only signature excluded (or hidden): nothing to draw.
    await m.saveRandomSig(settings({ excluded: [m.a.id], tiers: [tier(5_000, m.a.price, m.a.price)] }));
    await m.text(5_000);
    expect(m.lastAlert()).toMatchObject({ typeLabel: "일반 후원" });
    // A 금액 일치 signature made later takes the amount first.
    await m.saveRandomSig(settings({ tiers: [tier(5_000, m.a.price, m.a.price)] }));
    await m.signatures.saveSignature({ ...m.b, match: "AMOUNT", price: 5_000 });
    await m.text(5_000);
    expect(m.lastAlert()).toMatchObject({ typeLabel: `시그니처 · ${m.b.name}`, signatureId: m.b.id });
  });

  it("records a run for a member while live: 기본 모드 × 기본 배수, or the drawn signature's points instead", async () => {
    const m = await load();
    const id = await m.start();
    await m.saveRandomSig(settings({ multiplier: 3, tiers: [tier(5_000, m.a.price, m.a.price), tier(30_000, m.a.price, m.a.price)] }));
    await m.text(5_000, "cm-s2"); // drawn 10,002 ≥ 5,000 → ×3
    await m.text(30_000, "cm-s2"); // drawn 10,002 < 30,000 → ×1
    await m.text(5_000); // no member: the alert only
    expect(m.runs(id).map((r) => [r.memberId, r.kind, r.value, r.points, r.label])).toEqual([
      ["cm-s2", "MULTIPLY", 3, 10_000, m.a.name],
      ["cm-s2", "MULTIPLY", 1, 0, m.a.name]
    ]);
    expect(m.runs(id)[0]).toMatchObject({ game: "RANDOM_SIG", trigger: { kind: "AMOUNT", amount: 5_000 }, itemId: m.a.id, range: [m.a.price, m.a.price], showAt: at(4).toISOString() });

    await m.saveRandomSig(settings({ mode: "REPLACE", tiers: [tier(5_000, m.a.price, m.a.price), tier(30_000, m.a.price, m.a.price)] }));
    await m.text(5_000, "cm-s3"); // 10,002 instead of 5,000
    await m.text(30_000, "cm-s3"); // 10,002 instead of 30,000
    expect(m.runs(id).slice(2).map((r) => [r.kind, r.points])).toEqual([
      ["ADD", 5_002],
      ["ADD", -19_998]
    ]);
    vi.setSystemTime(at(60));
    const live = (await m.getBroadcastView())!.live!;
    expect(live.rows.find((r) => r.memberId === "cm-s3")).toMatchObject({ donated: 35_000, game: 5_002 - 19_998, score: m.a.price * 2 });
    expect(live.randomSig.runs[0]).toMatchObject({ trigger: { kind: "AMOUNT", amount: 30_000 }, range: [m.a.price, m.a.price] });
    expect(live.randomSig.pool.map((s) => s.id)).toContain(m.a.id);
    // 랜덤시그 plays only for its 발동 금액.
    expect(await m.playGame({ game: "RANDOM_SIG", broadcastId: id, requestId: key(1), memberId: "cm-s2" })).toEqual({ status: "INVALID", message: "랜덤시그는 발동 금액 후원이 들어올 때만 돌아가요." });
  });

  it("앞자리 배수 (2026-10-26): the drawn signature's price in 자리 units is the 배수, whatever the 발동 금액", async () => {
    const m = await load();
    const id = await m.start();
    expect(await m.signatures.saveSignature({ ...m.b, price: 2_500_000 })).toMatchObject({ status: "SAVED" });
    const only = tier(5_000, 1_000_000, 3_000_000); // signature b only
    // 백만 자리 (기본): 2,500,000 FN → ×2, the 기본 배수 (×3) not used.
    expect(await m.saveRandomSig(settings({ multiplier: 3, digit: true, tiers: [only] }))).toEqual({ status: "SAVED" });
    expect((await m.getGamesView())!.randomSigSettings).toMatchObject({ digit: true, digitUnit: 1_000_000 });
    await m.text(5_000, "cm-s2");
    // 십만 자리: ×25.
    await m.saveRandomSig(settings({ digit: true, digitUnit: 100_000, tiers: [only] }));
    await m.text(5_000, "cm-s2");
    // Off, or 랜덤 결과 모드: as before (no 자리 on the run).
    await m.saveRandomSig(settings({ multiplier: 3, tiers: [only] }));
    await m.text(5_000, "cm-s2");
    await m.saveRandomSig(settings({ mode: "REPLACE", digit: true, tiers: [tier(5_000, 0, 3_000_000), tier(6_000, 2_000_000, 3_000_000)] }));
    await m.text(6_000, "cm-s2");
    expect(m.runs(id).map((r) => [r.kind, r.value, r.points, r.digit])).toEqual([
      ["MULTIPLY", 2, 5_000, 1_000_000],
      ["MULTIPLY", 25, 120_000, 100_000],
      ["MULTIPLY", 3, 10_000, undefined],
      ["ADD", 2_494_000, 2_494_000, undefined]
    ]);
    vi.setSystemTime(at(60));
    const runs = (await m.getBroadcastView())!.live!.randomSig.runs;
    expect(runs.map((r) => r.digit)).toEqual([null, null, 100_000, 1_000_000]);

    const bad: [Partial<RandomSigSettings>, string][] = [
      [{ digit: true, tiers: [tier(5_000, 999_999, 3_000_000)] }, "시그 최소는 1,000,000 FN(백만 자리) 이상"],
      [{ digit: true, digitUnit: 1_000, tiers: [tier(5_000, 1_000, 101_000)] }, "100배까지예요. 시그 최대를 100,999 FN 이하로"],
      [{ digitUnit: 5_000 }, "자리 단위를 골라"],
      [{ digit: "yes" as unknown as boolean }, "앞자리 배수를 확인"]
    ];
    for (const [patch, message] of bad) {
      const res = await m.saveRandomSig(settings(patch));
      expect(res.status === "INVALID" && res.message, message).toContain(message);
    }
    // The limits hold only where 앞자리 배수 counts (기본 모드), and a tier at exactly ×100 is fine.
    expect(await m.saveRandomSig(settings({ mode: "REPLACE", digit: true, tiers: [tier(5_000, 0, 10_000_000)] }))).toEqual({ status: "SAVED" });
    expect(await m.saveRandomSig(settings({ digit: true, digitUnit: 1_000, tiers: [tier(5_000, 1_000, 100_999)] }))).toEqual({ status: "SAVED" });
  });

  it("counts as the drawn signature for the other games and 시그 카운트", async () => {
    const m = await load();
    const id = await m.start();
    await m.saveRandomSig(settings({ tiers: [tier(5_000, m.a.price, m.a.price)] }));
    await m.saveSpinMachine({ ...DEFAULT_SPIN, auto: true, items: [{ id: "x", label: "+500", kind: "ADD", value: 500, weight: 1 }] });
    await m.text(5_000, "cm-s2");
    expect(m.runs(id).map((r) => [r.game, r.trigger.kind])).toEqual([
      ["RANDOM_SIG", "AMOUNT"],
      ["SPIN", "SIGNATURE"]
    ]);
    const { saveSigCount } = await import("./crewSigCount");
    await saveSigCount({ title: "", signatureIds: [m.a.id], rows: "RECEIVED", sort: "TOTAL", showTotal: true });
    expect((await m.getBroadcastView())!.live!.sigCount.rows).toMatchObject([{ memberId: "cm-s2", counts: [1] }]);
  });
});
