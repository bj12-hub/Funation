import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import { DEFAULT_SPIN } from "./crewTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 마이너스 시그니처 (2026-11-01, policy-decisions 6 (a) "점수를 깎는 후원" as a crew option). */
async function load() {
  const bc = await import("./crewBroadcast");
  const minus = await import("./crewMinus");
  const games = await import("./crewGames");
  const crewCore = await import("./crewCore");
  const { mockCrew } = await import("./mockCrewStore");
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
  const sign = (s: { id: string; price: number }, memberId?: string) =>
    requestDonation({ creatorId: "studio", hideProfile: false, type: "SIGNATURE", signatureId: s.id, message: "", amount: s.price, expectedAmount: s.price, idempotencyKey: key(++n), memberId });
  // The seed attributions are stamped when the store is made (T0): the broadcast starts a second later.
  const start = async () => {
    vi.setSystemTime(at(1));
    expect(await bc.startBroadcast({ requestId: crypto.randomUUID(), title: "마이너스 방송", teamMode: false })).toEqual({ status: "SAVED" });
  };
  const row = async (memberId: string) => (await bc.getBroadcastView())!.live!.rows.find((r) => r.memberId === memberId)!;
  return { ...bc, ...minus, ...games, crewCore, mockCrew, a, b, sign, start, row };
}

const T0 = new Date("2026-11-01T12:00:00Z");
const at = (sec: number) => new Date(T0.getTime() + sec * 1000);

describe("마이너스 시그니처", () => {
  beforeEach(() => {
    resetMockStores();
    vi.useFakeTimers({ now: T0, toFake: ["Date"] });
  });
  afterEach(() => vi.useRealTimers());

  it("validates and saves the settings (off by default)", async () => {
    const m = await load();
    expect((await m.getBroadcastView())!.minusSettings).toEqual({ signatureIds: [], excludedMembers: [] });
    expect(await m.saveMinusSignatures({ signatureIds: [m.a.id, m.a.id], excludedMembers: ["cm-s3"] })).toEqual({ status: "SAVED" });
    expect((await m.getBroadcastView())!.minusSettings).toEqual({ signatureIds: [m.a.id], excludedMembers: ["cm-s3"] });
    expect(await m.saveMinusSignatures({ signatureIds: ["sig-nope"], excludedMembers: [] })).toEqual({ status: "INVALID", message: "마이너스 시그니처를 확인해 주세요." });
    expect(await m.saveMinusSignatures({ signatureIds: [], excludedMembers: ["cm-nope"] })).toEqual({ status: "INVALID", message: "제외할 멤버를 확인해 주세요." });
    expect(await m.saveMinusSignatures({ signatureIds: "all", excludedMembers: [] })).toMatchObject({ status: "INVALID" });
    const ids = Array.from({ length: 21 }, (_, i) => `s${i}`);
    expect(m.crewCore.parseMinusSettings({ signatureIds: ids, excludedMembers: [] }, ids, [])).toEqual({ message: "마이너스 시그니처는 20개까지 고를 수 있어요." });
    signIn(["SUPPORTER"]);
    expect(await m.saveMinusSignatures({ signatureIds: [], excludedMembers: [] })).toEqual({ status: "UNAUTHORIZED" });
  });

  it("takes a 마이너스 시그니처 후원's points off the member, the others add as usual", async () => {
    const m = await load();
    await m.saveMinusSignatures({ signatureIds: [m.a.id], excludedMembers: ["cm-s3"] });
    await m.start();
    await m.sign(m.a, "cm-s1"); // 마이너스
    await m.sign(m.b, "cm-s1"); // a usual signature
    await m.sign(m.a, "cm-s3"); // 제외 멤버: adds as usual
    expect((await m.row("cm-s1")).donated).toBe(m.b.price - m.a.price);
    expect((await m.row("cm-s3")).donated).toBe(m.a.price);
    // Fixed when it came in: turning it off later does not flip it.
    await m.saveMinusSignatures({ signatureIds: [], excludedMembers: [] });
    expect((await m.row("cm-s1")).donated).toBe(m.b.price - m.a.price);
    const flags = m.mockCrew.attributions.filter((x) => x.memberId === "cm-s1" && x.at >= at(1).toISOString()).map((x) => !!x.minus);
    expect(flags).toEqual([true, false]);
  });

  it("plays no 점수 게임 for it and keeps it out of the 기준 후원 choices", async () => {
    const m = await load();
    const { mockCrew } = m;
    mockCrew.spinMachines = { studio: { ...DEFAULT_SPIN, auto: true, items: [{ id: "i1", label: "꽝", kind: "TEXT", value: 0, weight: 1 }] } };
    await m.saveMinusSignatures({ signatureIds: [m.a.id], excludedMembers: [] });
    await m.start();
    await m.sign(m.a, "cm-s1");
    await m.sign(m.b, "cm-s1");
    const view = (await m.getGamesView())!.live!;
    expect(view.spin.runs).toHaveLength(1);
    // 주사위 (자동 off) still offers the usual one; the 마이너스 one is no 기준 후원.
    expect(view.sources.DICE["cm-s1"].map((s) => s.points)).toEqual([m.b.price]);
  });

  it("keeps the FN members received as it was (월간 멤버 순위)", async () => {
    const m = await load();
    const fnOf = () => m.crewCore.memberRanking("studio", at(5)).find((r) => r.memberId === "cm-s1")!.totalFn;
    const before = fnOf();
    await m.saveMinusSignatures({ signatureIds: [m.a.id], excludedMembers: [] });
    await m.start();
    await m.sign(m.a, "cm-s1");
    expect(fnOf()).toBe(before + m.a.price);
    expect((await m.row("cm-s1")).donated).toBe(-m.a.price);
  });
});
