import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import { landingTurn, sliceAngles } from "@/features/creatorStudio/widgets/WheelView";
import { WHEEL_RESULT_SEC, WHEEL_STOP_SEC } from "./broadcastToolTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 원형 룰렛 (code-first, 2026-10-30 — StreamDonate 원형 룰렛 참고): a 방송 도구 the server spins. */
async function load() {
  const tools = await import("./broadcastTools");
  const core = await import("./broadcastToolsCore");
  const alerts = await import("./alertCore");
  const { mockCreator } = await import("./mockCreatorStore");
  const { mockSignatures } = await import("@/services/donations/signatureCore");
  const overlay = async () => {
    const v = await tools.getOverlayTool("wheel", mockCreator.integrationKey);
    if (v === "FORBIDDEN" || v.tool !== "wheel") throw new Error("expected wheel");
    return v;
  };
  return { ...tools, ...core, ...alerts, mockSignatures, overlay, overlayKey: mockCreator.integrationKey };
}

const T0 = new Date("2026-10-30T12:00:00Z");
const at = (sec: number) => vi.setSystemTime(new Date(T0.getTime() + sec * 1000));
const text = (label: string, qty = 1) => ({ kind: "TEXT", label, signatureId: null, qty });
const wheel = (patch: Record<string, unknown> = {}) => ({ title: "벌칙 룰렛", stopMode: "AUTO", autoSpin: false, items: [text("노래"), text("댄스", 3)], ...patch });

describe("원형 룰렛", () => {
  beforeEach(() => {
    resetMockStores();
    vi.useFakeTimers({ now: T0, toFake: ["Date"] });
  });
  afterEach(() => vi.useRealTimers());

  it("validates and saves the 칸 — a 문구 or a signature by its name, ×수량", async () => {
    const m = await load();
    const sig = m.mockSignatures.items[0];
    expect(await m.saveWheel(wheel({ title: " 벌칙 룰렛 ", items: [text(" 노래 "), { kind: "SIGNATURE", label: "아무거나", signatureId: sig.id, qty: 2 }] }))).toEqual({ status: "SAVED" });
    const saved = (await m.getToolsView())!.states.wheel.settings;
    expect(saved).toEqual({ title: "벌칙 룰렛", stopMode: "AUTO", autoSpin: false, items: [text("노래"), { kind: "SIGNATURE", label: sig.name, signatureId: sig.id, qty: 2 }] });
    expect((await m.getToolsView())!.signatures).toContainEqual({ id: sig.id, name: sig.name });

    const bad: [Record<string, unknown>, string][] = [
      [{ title: "가".repeat(21) }, "룰렛 이름"],
      [{ stopMode: "SLOW" }, "설정"],
      [{ autoSpin: "yes" }, "설정"],
      [{ items: Array.from({ length: 21 }, (_, i) => text(`칸${i}`)) }, "20개까지"],
      [{ items: [text("노래", 0)] }, "수량"],
      [{ items: [text("노래", 21)] }, "수량"],
      [{ items: [text("  ")] }, "칸 문구"],
      [{ items: [text("가".repeat(21))] }, "칸 문구"],
      [{ items: [{ kind: "SIGNATURE", label: "", signatureId: "sig-nope", qty: 1 }] }, "시그니처"],
      [{ items: [{ kind: "IMAGE", label: "x", signatureId: null, qty: 1 }] }, "칸 종류"],
      [{ items: [text("운영자 벌칙")] }, "사용할 수 없는"]
    ];
    for (const [patch, message] of bad) {
      const res = await m.saveWheel(wheel(patch));
      expect(res.status === "INVALID" && res.message, message).toContain(message);
    }
    signIn(["SUPPORTER"]);
    expect(await m.saveWheel(wheel())).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.spinWheel({ requestId: key(1) })).toEqual({ status: "UNAUTHORIZED" });
  });

  it("자동 멈춤: 스핀! draws the result at once and slows down; more spins wait their turn", async () => {
    const m = await load();
    expect(await m.spinWheel({ requestId: key(1) })).toEqual({ status: "INVALID", message: "룰렛 칸을 먼저 저장해 주세요." });
    await m.saveWheel(wheel());
    expect(await m.spinWheel({ requestId: key(1) })).toEqual({ status: "SAVED" });
    expect(await m.spinWheel({ requestId: key(1) })).toEqual({ status: "SAVED" }); // retried: the same spin
    let v = await m.overlay();
    expect(v.current).toMatchObject({ trigger: "MANUAL", donor: null, stopMode: "AUTO", startAt: T0.toISOString(), stopAt: T0.toISOString(), slices: [{ label: "노래", qty: 1 }, { label: "댄스", qty: 3 }] });
    expect([0, 1]).toContain(v.current!.result);
    expect(v.waiting).toBe(0);

    // A second spin waits until the first has slowed down and shown its result.
    at(2);
    await m.spinWheel({ requestId: key(2) });
    expect((await m.overlay()).waiting).toBe(1);
    const second = (await m.getToolsView())!.states.wheel.spins[1];
    expect(second.startAt).toBe(new Date(T0.getTime() + (WHEEL_STOP_SEC + WHEEL_RESULT_SEC) * 1000).toISOString());
    at(WHEEL_STOP_SEC + WHEEL_RESULT_SEC);
    v = await m.overlay();
    expect([v.current!.id, v.waiting]).toEqual([second.id, 0]);

    expect(await m.clearWheel()).toEqual({ status: "SAVED" });
    expect((await m.overlay()).current).toBeNull();
  });

  it("수동 멈춤: spins until 멈춤 — the result is drawn then and kept off OBS until it stops", async () => {
    const m = await load();
    await m.saveWheel(wheel({ stopMode: "MANUAL" }));
    expect(await m.stopWheel()).toEqual({ status: "INVALID", message: "돌아가고 있는 룰렛이 없어요." });
    await m.spinWheel({ requestId: key(1) });
    await m.spinWheel({ requestId: key(2) });
    let v = await m.overlay();
    expect(v.current).toMatchObject({ stopMode: "MANUAL", stopAt: null, result: null });
    expect(v.waiting).toBe(1);
    expect((await m.getToolsView())!.states.wheel.spins.map((s) => s.result)).toEqual([null, null]);

    at(30);
    expect(await m.stopWheel()).toEqual({ status: "SAVED" });
    v = await m.overlay();
    expect(v.current!.stopAt).toBe(new Date(T0.getTime() + 30_000).toISOString());
    expect([0, 1]).toContain(v.current!.result);
    // The next one starts once this one is done, and spins until its own 멈춤.
    at(30 + WHEEL_STOP_SEC + WHEEL_RESULT_SEC);
    v = await m.overlay();
    expect(v.current).toMatchObject({ stopAt: null, result: null, startAt: new Date(T0.getTime() + (30 + WHEEL_STOP_SEC + WHEEL_RESULT_SEC) * 1000).toISOString() });
  });

  it("후원 시 자동 스핀: every completed donation queues a spin with its donor's name, once", async () => {
    const m = await load();
    const donate = (donor: string) => m.enqueueDonationAlert("studio", { donor, donorKey: `k-${donor}`, message: "", fnAmount: 1_000, typeLabel: "일반 후원" });
    await m.saveWheel(wheel());
    donate("달빛");
    expect((await m.getToolsView())!.states.wheel.spins).toHaveLength(0); // off
    await m.saveWheel(wheel({ autoSpin: true }));
    const item = donate("하루봄")!;
    donate("새벽");
    const spins = (await m.getToolsView())!.states.wheel.spins;
    expect(spins.map((s) => [s.id, s.trigger, s.donor])).toEqual([
      [`wh-d-${item.id}`, "DONATION", "하루봄"],
      [expect.stringMatching(/^wh-d-/), "DONATION", "새벽"]
    ]);
    expect(m.spinWheelForDonation(item.id, "하루봄")!.id).toBe(`wh-d-${item.id}`); // the same donation again: the same spin
    expect((await m.getToolsView())!.states.wheel.spins).toHaveLength(2);
    expect(await m.getOverlayTool("wheel", "wrong-key")).toBe("FORBIDDEN");
  });

  it("draws by ×수량 and lands the drawn slice under the pointer", async () => {
    const { drawWheel } = await load();
    const counts = [0, 0];
    for (let i = 0; i < 4_000; i++) counts[drawWheel([{ qty: 1 }, { qty: 3 }])] += 1;
    expect(counts[1] / 4_000).toBeGreaterThan(0.68);
    expect(counts[1] / 4_000).toBeLessThan(0.82);
    expect(sliceAngles([{ qty: 1 }, { qty: 3 }])).toEqual([
      { from: 0, to: 90 },
      { from: 90, to: 360 }
    ]);
    // The middle of the second slice (225°) ends at the top after six turns.
    expect(landingTurn([{ qty: 1 }, { qty: 3 }], 1)).toBe(6 * 360 - 225);
    expect((landingTurn([{ qty: 1 }, { qty: 3 }], 0) + 45) % 360).toBe(0);
  });
});
