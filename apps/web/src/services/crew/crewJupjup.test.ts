import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import { DEFAULT_JUPJUP, DEFAULT_SPIN, type JupjupSettings } from "./crewTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 줍줍 (2026-10-24, StreamDonate 줍줍 참고, P2) on the 점수 게임 engine. */
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
    expect(await bc.startBroadcast({ requestId: crypto.randomUUID(), title: "줍줍 방송", teamMode: false })).toEqual({ status: "SAVED" });
    return (await bc.getBroadcastView())!.live!.id;
  };
  const runs = (id: string) => (mockCrew.broadcasts!.find((x) => x.id === id)!.gameRuns ?? []).filter((r) => r.game === "JUPJUP");
  const jupjup = async () => (await games.getGamesView())!.live!.jupjup;
  const stack = async () => (await jupjup()).stack.map((x) => `${x.memberName} ${x.amount}`);
  return { ...bc, ...games, a, b, sign, start, runs, jupjup, stack, overlayKey: mockCreator.integrationKey };
}

const T0 = new Date("2026-10-24T12:00:00Z");
const at = (sec: number) => new Date(T0.getTime() + sec * 1000);
const settings = (patch: Partial<JupjupSettings> = {}) => ({ ...DEFAULT_JUPJUP, auto: true, memberIds: ["cm-s1"], ...patch });

describe("줍줍", () => {
  beforeEach(() => {
    resetMockStores();
    vi.useFakeTimers({ now: T0, toFake: ["Date"] });
  });
  afterEach(() => vi.useRealTimers());

  it("validates and saves the settings", async () => {
    const m = await load();
    expect(await m.saveJupjup(settings({ title: " 줍줍판 ", memberIds: ["cm-s1", "cm-s1", "cm-s2"], mode: "MULTIPLY", tiers: [{ id: "x", min: 0, max: null, multiplier: 2 }] }))).toEqual({ status: "SAVED" });
    expect((await m.getGamesView())!.jupjupSettings).toMatchObject({ title: "줍줍판", memberIds: ["cm-s1", "cm-s2"], mode: "MULTIPLY", tiers: [{ min: 0, max: null, multiplier: 2 }] });
    // Off, it needs no 지정 BJ.
    expect(await m.saveJupjup({ ...DEFAULT_JUPJUP })).toEqual({ status: "SAVED" });

    const bad: [Record<string, unknown>, string][] = [
      [{ memberIds: ["cm-s4"] }, "지정 BJ를 다시"], // inactive
      [{ memberIds: "cm-s1" }, "지정 BJ를 다시"],
      [{ memberIds: [] }, "지정 BJ를 한 명 이상"],
      [{ mode: "STEAL" }, "줍줍 모드"],
      [{ mode: "MULTIPLY", tiers: [] }, "금액 구간을 하나 이상"],
      [{ tiers: [{ id: "x", min: 5, max: 4, multiplier: 2 }] }, "금액 구간"],
      [{ tiers: [{ id: "x", min: 0, max: null, multiplier: 1 }] }, "배수"],
      [{ excluded: ["sig-nope"] }, "제외할 시그니처"]
    ];
    for (const [patch, message] of bad) {
      const res = await m.saveJupjup(settings(patch as Partial<JupjupSettings>));
      expect(res.status === "INVALID" && res.message, message).toContain(message);
    }
    signIn(["SUPPORTER"]);
    expect(await m.saveJupjup(settings())).toEqual({ status: "UNAUTHORIZED" });
  });

  it("stacks the 지정 BJ's 시그니처 후원 and lets another member take the oldest of the same amount once more", async () => {
    const m = await load();
    const id = await m.start();
    await m.saveJupjup(settings());
    await m.sign(m.a.id, m.a.price, "cm-s1");
    await m.sign(m.b.id, m.b.price, "cm-s1");
    await m.sign(m.a.id, m.a.price, "cm-s1");
    expect(await m.stack()).toEqual([`길동 ${m.a.price}`, `길동 ${m.b.price}`, `길동 ${m.a.price}`]);

    await m.sign(m.a.id, m.a.price, "cm-s2"); // takes the first a
    expect(m.runs(id)).toHaveLength(1);
    expect(m.runs(id)[0]).toMatchObject({ memberId: "cm-s2", kind: "ADD", value: m.a.price, points: m.a.price, label: "줍줍", from: { memberId: "cm-s1", amount: m.a.price } });
    expect(await m.stack()).toEqual([`길동 ${m.b.price}`, `길동 ${m.a.price}`]);
    await m.sign(m.b.id, m.b.price, "cm-s3");
    await m.sign(m.b.id, m.b.price, "cm-s3"); // no b left
    await m.sign(m.a.id, m.a.price); // no member picked: neither stacks nor takes
    expect(m.runs(id).map((r) => r.memberId)).toEqual(["cm-s2", "cm-s3"]);
    expect(await m.stack()).toEqual([`길동 ${m.a.price}`]);

    // Shown on OBS ?jupjup, counted once the result shows.
    const view = await m.jupjup();
    expect(view).toMatchObject({ stackCount: 1, ownerNames: ["길동"] });
    expect(view.runs[0]).toMatchObject({ memberName: "바다", from: { memberName: "길동", amount: m.b.price } });
    expect((await m.getBroadcastView())!.live!.rows.find((r) => r.memberId === "cm-s2")!.game).toBe(0);
    vi.setSystemTime(at(20));
    expect((await m.getBroadcastView())!.live!.rows.find((r) => r.memberId === "cm-s2")!.game).toBe(m.a.price);
    const overlay = await m.getOverlayScoreboard(m.overlayKey);
    expect(overlay !== "IDLE" && overlay !== "FORBIDDEN" && overlay.jupjup.stackCount).toBe(1);

    // 지정 BJ never take from each other: their 후원 goes on the stack.
    await m.saveJupjup(settings({ memberIds: ["cm-s1", "cm-s2"] }));
    await m.sign(m.a.id, m.a.price, "cm-s2");
    expect(await m.stack()).toEqual([`길동 ${m.a.price}`, `하늘 ${m.a.price}`]);
    expect(await m.playGame({ game: "JUPJUP", broadcastId: id, requestId: key(1), memberId: "cm-s3" })).toEqual({ status: "INVALID", message: "줍줍은 같은 금액의 시그니처 후원으로만 가져가요." });
  });

  it("applies the 배수 모드 and the 스핀머신 연계, and leaves excluded signatures out", async () => {
    const m = await load();
    const id = await m.start();
    await m.saveJupjup(settings({ mode: "MULTIPLY", tiers: [{ id: "t", min: 0, max: null, multiplier: 3 }] }));
    await m.sign(m.a.id, m.a.price, "cm-s1");
    await m.sign(m.a.id, m.a.price, "cm-s2");
    expect(m.runs(id).at(-1)).toMatchObject({ kind: "MULTIPLY", value: 3, points: m.a.price * 2, label: "줍줍 ×3" });

    // 스핀머신 연계: the spin of the same donation (×3) → 줍줍 adds 3 × the points; without a 배수 spin, 1 ×.
    await m.saveSpinMachine({ ...DEFAULT_SPIN, auto: true, items: [{ id: "x", label: "×3", kind: "MULTIPLY", value: 3, weight: 1 }] });
    await m.saveJupjup(settings({ mode: "SPIN" }));
    await m.sign(m.a.id, m.a.price, "cm-s1");
    await m.sign(m.a.id, m.a.price, "cm-s2");
    expect(m.runs(id).at(-1)).toMatchObject({ kind: "ADD", value: m.a.price * 3, points: m.a.price * 3, label: "줍줍 · 스핀 ×3 연계" });
    await m.saveSpinMachine({ ...DEFAULT_SPIN, auto: false, items: [{ id: "x", label: "×3", kind: "MULTIPLY", value: 3, weight: 1 }] });
    await m.sign(m.a.id, m.a.price, "cm-s1");
    await m.sign(m.a.id, m.a.price, "cm-s2");
    expect(m.runs(id).at(-1)).toMatchObject({ value: m.a.price, label: "줍줍" });

    await m.saveJupjup(settings({ excluded: [m.b.id] }));
    await m.sign(m.b.id, m.b.price, "cm-s1"); // not stacked
    expect(await m.stack()).toEqual([]);
  });

  it("lets the operator add, remove and clear stack items", async () => {
    const m = await load();
    const id = await m.start();
    await m.saveJupjup(settings());
    const add = (requestId: string, extra: Record<string, unknown> = {}) => m.addJupjup({ broadcastId: id, requestId, memberId: "cm-s1", signatureId: m.a.id, ...extra });
    expect(await add(key(1))).toEqual({ status: "SAVED" });
    expect(await add(key(1))).toEqual({ status: "SAVED" }); // retried: one item
    expect(await add(key(2), { signatureId: m.b.id })).toEqual({ status: "SAVED" });
    expect((await m.jupjup()).stack.map((x) => [x.signatureName, x.amount, x.manual])).toEqual([
      [m.a.name, m.a.price, true],
      [m.b.name, m.b.price, true]
    ]);
    expect(await add(key(3), { memberId: "cm-s2" })).toEqual({ status: "INVALID", message: "지정 BJ를 골라 주세요." });
    expect(await add(key(4), { signatureId: "sig-nope" })).toEqual({ status: "INVALID", message: "시그니처를 골라 주세요." });
    expect((await add("short")).status).toBe("INVALID");

    // A manual item is taken like any other.
    await m.sign(m.a.id, m.a.price, "cm-s3");
    expect(m.runs(id)).toHaveLength(1);
    const left = (await m.jupjup()).stack;
    expect(left).toHaveLength(1);
    expect(await m.removeJupjup({ broadcastId: id, itemId: left[0].id })).toEqual({ status: "SAVED" });
    await add(key(5));
    await add(key(6));
    expect(await m.removeJupjup({ broadcastId: id, itemId: null })).toEqual({ status: "SAVED" });
    expect((await m.jupjup()).stackCount).toBe(0);
    expect(await m.removeJupjup({ broadcastId: "bc-x", itemId: null })).toEqual({ status: "INVALID", message: "진행 중인 방송이 아니에요." });
    signIn(["SUPPORTER"]);
    expect(await add(key(7))).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.removeJupjup({ broadcastId: id, itemId: null })).toEqual({ status: "UNAUTHORIZED" });
  });
});
