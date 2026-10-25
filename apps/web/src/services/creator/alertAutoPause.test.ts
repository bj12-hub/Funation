import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 자동 일시정지 금액 (2026-10-25, StreamDonate 빠른 설정 참고 — 기본값): a big alert plays, the ones after it wait. */
async function load() {
  const remote = await import("./alertRemote");
  const core = await import("./alertCore");
  const { mockCreator } = await import("./mockCreatorStore");
  core.mockAlerts.items.length = 0;
  let n = 0;
  const test = (amount: number, donor: string) => remote.sendTestAlert({ requestId: key(++n), amount, donor });
  const onScreen = async () => {
    const res = await remote.getOverlayAlert(mockCreator.integrationKey);
    if (res === "FORBIDDEN") throw new Error("forbidden");
    return res.alert?.donor ?? null;
  };
  const view = async () => (await remote.getRemoteView())!;
  return { ...remote, ...core, test, onScreen, view };
}

const at = (sec: number) => vi.setSystemTime(new Date(Date.parse("2026-10-25T12:00:00Z") + sec * 1000));

describe("자동 일시정지 금액", () => {
  beforeEach(() => {
    resetMockStores();
    vi.useFakeTimers({ now: new Date("2026-10-25T12:00:00Z"), toFake: ["Date"] });
  });
  afterEach(() => vi.useRealTimers());

  it("lets an alert of at least the amount play, then holds the ones after it until 알림 재개", async () => {
    const m = await load();
    expect(m.mockAlerts.controls.autoPauseFn).toBe(0);
    expect(await m.setAlertControls({ autoPauseFn: 10_000, displaySec: 5 })).toEqual({ status: "SAVED" });
    await m.test(5_000, "A");
    await m.test(10_000, "B");
    await m.test(3_000, "C");
    expect(await m.onScreen()).toBe("A");
    expect((await m.view()).autoPausedBy).toBeNull();

    at(5);
    expect(await m.onScreen()).toBe("B"); // at the amount: it plays …
    let view = await m.view();
    expect(view.controls.paused).toBe(true);
    expect(view.autoPausedBy).toMatchObject({ donor: "B", fnAmount: 10_000 });

    at(10);
    expect(await m.onScreen()).toBeNull(); // … and the queue waits after it
    view = await m.view();
    expect(view.queued.map((a) => a.donor)).toEqual(["C"]);
    expect(view.autoPausedBy?.donor).toBe("B");

    expect(await m.setAlertControls({ paused: false })).toEqual({ status: "SAVED" });
    expect(await m.onScreen()).toBe("C");
    expect((await m.view()).autoPausedBy).toBeNull();
  });

  it("is off at 0, and platform · 계좌 후원 alerts and 다시 보내기 copies never pause", async () => {
    const m = await load();
    await m.setAlertControls({ displaySec: 5 });
    await m.test(100_000, "큰손");
    expect((await m.view()).controls.paused).toBe(false);

    at(5);
    await m.setAlertControls({ autoPauseFn: 1_000 });
    m.enqueueAlert({ kind: "EXTERNAL", donor: "입금자", message: "", fnAmount: 0, amountLabel: "₩50,000", typeLabel: "계좌 후원", native: { value: 50_000, unit: "KRW" } });
    expect(await m.onScreen()).toBe("입금자");
    expect((await m.view()).controls.paused).toBe(false);

    at(10);
    const big = (await m.view()).recent.find((a) => a.donor === "큰손")!;
    expect(await m.replayAlert({ id: big.id, requestId: key(50) })).toEqual({ status: "SAVED" });
    expect(await m.onScreen()).toBe("큰손");
    expect((await m.view()).controls.paused).toBe(false);
  });

  it("hands the pause to the operator once they pause or resume themselves", async () => {
    const m = await load();
    await m.setAlertControls({ autoPauseFn: 2_000 });
    await m.test(2_000, "A");
    await m.test(1_000, "B");
    expect((await m.view()).autoPausedBy?.donor).toBe("A");
    // ⏸ pressed while already paused: still paused, but no longer "after A".
    await m.setAlertControls({ paused: true });
    const view = await m.view();
    expect(view.controls.paused).toBe(true);
    expect(view.autoPausedBy).toBeNull();
  });

  it("checks the amount, and is the creator's", async () => {
    const m = await load();
    for (const bad of [-1, 1.5, "1000", 10_000_001, null]) {
      expect((await m.setAlertControls({ autoPauseFn: bad })).status).toBe("INVALID");
    }
    expect(await m.setAlertControls({ autoPauseFn: 0 })).toEqual({ status: "SAVED" });
    signIn(["SUPPORTER"]);
    expect(await m.setAlertControls({ autoPauseFn: 5_000 })).toEqual({ status: "UNAUTHORIZED" });
  });
});

describe("다시 보내기 of a held alert", () => {
  beforeEach(() => resetMockStores());

  it("queues a copy that is not held (no 후원 리스트 entry would ever let it go)", async () => {
    const m = await load();
    const held = m.enqueueAlert({ kind: "EXTERNAL", donor: "입금자", message: "", fnAmount: 0, amountLabel: "₩10,000", typeLabel: "계좌 후원", held: true });
    expect(await m.onScreen()).toBeNull();
    await m.cancelAllAlerts();
    expect(held).toMatchObject({ status: "SKIPPED", held: true });
    expect(await m.replayAlert({ id: held.id, requestId: key(60) })).toEqual({ status: "SAVED" });
    const copy = m.mockAlerts.items.at(-1)!;
    expect(copy).toMatchObject({ replayOf: held.id, status: "SHOWING" });
    expect(copy.held).toBeUndefined();
  });
});
