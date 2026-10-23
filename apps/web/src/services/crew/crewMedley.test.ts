import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import { DEFAULT_MEDLEY, DEFAULT_RANDOM_SIG, DEFAULT_SPIN, type MedleySettings } from "./crewTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 시그니처 메들리 (2026-10-24, StreamDonate 메들리 참고) on the 점수 게임 engine. */
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
    requestDonation({ creatorId: "studio", hideProfile: false, type: "TEXT", amount, message: "메들리!", voiceId: null, idempotencyKey: key(++n), memberId });
  // The seed attributions are stamped when the store is made (T0): the broadcast starts a second later.
  const start = async () => {
    vi.setSystemTime(at(1));
    expect(await bc.startBroadcast({ requestId: crypto.randomUUID(), title: "메들리 방송", teamMode: false })).toEqual({ status: "SAVED" });
    return (await bc.getBroadcastView())!.live!.id;
  };
  const runs = (id: string) => mockCrew.broadcasts!.find((x) => x.id === id)!.gameRuns ?? [];
  const lastAlert = () => mockAlerts.items.at(-1)!;
  return { ...bc, ...games, signatures, a, b, text, start, runs, lastAlert, overlayKey: mockCreator.integrationKey };
}

const T0 = new Date("2026-10-24T12:00:00Z");
const at = (sec: number) => new Date(T0.getTime() + sec * 1000);
const settings = (patch: Partial<MedleySettings> = {}) => ({ ...DEFAULT_MEDLEY, auto: true, trigger: 5_000, signatureIds: ["sig-zero2"], ...patch });

describe("시그니처 메들리", () => {
  beforeEach(() => {
    resetMockStores();
    vi.useFakeTimers({ now: T0, toFake: ["Date"] });
  });
  afterEach(() => vi.useRealTimers());

  it("validates the 발동 금액 and the registered signatures, and keeps it apart from 금액 일치 and 랜덤시그", async () => {
    const m = await load();
    expect(await m.saveMedley(settings({ title: " 메들리 ", signatureIds: [m.a.id, m.b.id, m.a.id] }))).toEqual({ status: "SAVED" });
    expect((await m.getGamesView())!.medleySettings).toEqual({ title: "메들리", auto: true, excluded: [], showIdle: true, trigger: 5_000, signatureIds: [m.a.id, m.b.id] });
    // Off, it needs neither a 발동 금액 nor a signature.
    expect(await m.saveMedley({ ...DEFAULT_MEDLEY })).toEqual({ status: "SAVED" });

    await m.signatures.saveSignature({ ...m.b, match: "AMOUNT", rangeMin: 20_000 });
    const bad: [Record<string, unknown>, string][] = [
      [{ trigger: 99 }, "발동 금액은"],
      [{ trigger: 5_000.5 }, "발동 금액은"],
      [{ trigger: null }, "발동 금액을 정해"],
      [{ signatureIds: [] }, "하나 이상 등록"],
      [{ signatureIds: ["sig-nope"] }, "등록할 시그니처"],
      [{ trigger: 22_000 }, `'${m.b.name}'(20,000 ~ 24,444 FN) 시그니처가 금액 일치로 받아요`],
      [{ title: "운영자 메들리" }, "사용할 수 없는"]
    ];
    for (const [patch, message] of bad) {
      const res = await m.saveMedley(settings(patch as Partial<MedleySettings>));
      expect(res.status === "INVALID" && res.message, message).toContain(message);
    }

    // 랜덤시그 and 메들리 never share a 발동 금액 while both are on — whichever is saved second is refused.
    expect(await m.saveRandomSig({ ...DEFAULT_RANDOM_SIG, auto: true, tiers: [{ id: "t", trigger: 5_000, min: 0, max: 30_000 }] })).toEqual({ status: "SAVED" });
    expect(await m.saveMedley(settings())).toEqual({ status: "INVALID", message: "발동 금액 5,000 FN은 이미 랜덤시그 발동 구간에서 쓰고 있어요." });
    await m.saveRandomSig({ ...DEFAULT_RANDOM_SIG, auto: false, tiers: [{ id: "t", trigger: 5_000, min: 0, max: 30_000 }] });
    expect(await m.saveMedley(settings())).toEqual({ status: "SAVED" });
    expect(await m.saveRandomSig({ ...DEFAULT_RANDOM_SIG, auto: true, tiers: [{ id: "t", trigger: 5_000, min: 0, max: 30_000 }] })).toEqual({
      status: "INVALID",
      message: "발동 금액 5,000 FN은 시그니처 메들리가 쓰고 있어요."
    });
    signIn(["SUPPORTER"]);
    expect(await m.saveMedley(settings())).toEqual({ status: "UNAUTHORIZED" });
  });

  it("sends a 일반 후원 of exactly the 발동 금액 as one of the registered signatures", async () => {
    const m = await load();
    await m.saveMedley(settings({ signatureIds: [m.a.id] }));
    await m.text(5_000);
    expect(m.lastAlert()).toMatchObject({ typeLabel: `메들리 · ${m.a.name}`, signatureId: m.a.id, imageUrl: m.a.imageUrl });
    await m.text(5_001);
    expect(m.lastAlert()).toMatchObject({ typeLabel: "일반 후원" });
    // Its only signature hidden: nothing to draw.
    await m.signatures.saveSignature({ ...m.a, active: false });
    await m.text(5_000);
    expect(m.lastAlert()).toMatchObject({ typeLabel: "일반 후원" });
    // Off: a 일반 후원.
    await m.signatures.saveSignature({ ...m.a, active: true });
    await m.saveMedley(settings({ auto: false, signatureIds: [m.a.id] }));
    await m.text(5_000);
    expect(m.lastAlert()).toMatchObject({ typeLabel: "일반 후원" });
    // A 금액 일치 signature made later takes the amount first.
    await m.saveMedley(settings({ signatureIds: [m.a.id] }));
    await m.signatures.saveSignature({ ...m.b, match: "AMOUNT", price: 5_000 });
    await m.text(5_000);
    expect(m.lastAlert()).toMatchObject({ typeLabel: `시그니처 · ${m.b.name}` });
  });

  it("rolls each medley on OBS while live (no points), counts as the drawn signature, and rolls one by hand", async () => {
    const m = await load();
    const id = await m.start();
    await m.saveMedley(settings({ signatureIds: [m.a.id] }));
    await m.saveSpinMachine({ ...DEFAULT_SPIN, auto: true, items: [{ id: "x", label: "+500", kind: "ADD", value: 500, weight: 1 }] });
    await m.text(5_000, "cm-s2");
    await m.text(5_000); // no member: rolls on OBS all the same
    const medleys = m.runs(id).filter((r) => r.game === "MEDLEY");
    expect(medleys.map((r) => [r.memberId, r.label, r.points, r.trigger])).toEqual([
      ["cm-s2", m.a.name, 0, { kind: "AMOUNT", amount: 5_000 }],
      ["", m.a.name, 0, { kind: "AMOUNT", amount: 5_000 }]
    ]);
    // The other games count it as the drawn signature (스핀머신 자동 for the member's one).
    expect(m.runs(id).filter((r) => r.game === "SPIN").map((r) => r.trigger)).toEqual([{ kind: "SIGNATURE", signatureId: m.a.id, signatureName: m.a.name }]);
    const live = (await m.getBroadcastView())!.live!;
    expect(live.medley.runs.map((r) => r.memberName)).toEqual(["", "하늘"]);
    expect(live.medley.pool.map((s) => s.id)).toEqual([m.a.id]);
    vi.setSystemTime(at(60));
    expect((await m.getBroadcastView())!.live!.rows.find((r) => r.memberId === "cm-s2")!.game).toBe(500); // the spin only

    // 수동: rolls on OBS without an alert; a retry is the same run.
    const alerts = m.lastAlert().id;
    const hand = await m.playMedley({ broadcastId: id, requestId: key(1) });
    expect(hand).toMatchObject({ status: "PLAYED", run: { game: "MEDLEY", memberId: "", memberName: "", trigger: { kind: "MANUAL" }, label: m.a.name, points: 0 } });
    expect(await m.playMedley({ broadcastId: id, requestId: key(1) })).toEqual(hand);
    expect(m.lastAlert().id).toBe(alerts);
    expect(await m.playGame({ game: "MEDLEY", broadcastId: id, requestId: key(2), memberId: "cm-s2" })).toEqual({ status: "INVALID", message: "메들리는 'OBS에서 한 번 돌리기'로 돌려요." });
    await m.saveMedley({ ...DEFAULT_MEDLEY });
    expect(await m.playMedley({ broadcastId: id, requestId: key(3) })).toEqual({ status: "INVALID", message: "등록한 시그니처가 없어요. 메들리 시그니처를 먼저 등록해 주세요." });
    expect(await m.playMedley({ broadcastId: "bc-x", requestId: key(4) })).toEqual({ status: "INVALID", message: "진행 중인 방송이 아니에요." });
    signIn(["SUPPORTER"]);
    expect(await m.playMedley({ broadcastId: id, requestId: key(5) })).toEqual({ status: "UNAUTHORIZED" });
  });
});
