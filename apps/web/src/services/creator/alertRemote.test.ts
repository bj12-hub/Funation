import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 리모컨 (code-first): server-owned alert queue, display-only test alerts, key-guarded overlay. */
async function load() {
  const remote = await import("./alertRemote");
  const core = await import("./alertCore");
  const { mockCreator } = await import("./mockCreatorStore");
  const { mockAccount } = await import("@/services/account/mockStore");
  return { ...remote, ...core, mockAccount, overlayKey: mockCreator.integrationKey };
}

describe("리모컨 / 후원 알림 대기열", () => {
  beforeEach(() => resetMockStores());
  afterEach(() => vi.useRealTimers());

  it("queues test alerts once per request id and never touches FN", async () => {
    const { sendTestAlert, getRemoteView, mockAccount } = await load();
    const balance = mockAccount.fnBalance;
    expect(await sendTestAlert({ requestId: key(1), amount: 10_000, donor: "", message: "안녕" })).toEqual({ status: "SAVED" });
    expect(await sendTestAlert({ requestId: key(1), amount: 10_000, donor: "", message: "안녕" })).toEqual({ status: "SAVED" });
    await sendTestAlert({ requestId: key(2), amount: 5_000, donor: "철수", message: "" });
    const view = (await getRemoteView())!;
    expect(view.showing).toMatchObject({ donor: "테스트 후원자", fnAmount: 10_000, kind: "TEST" });
    expect(view.queued.map((a) => a.donor)).toEqual(["철수"]);
    expect(mockAccount.fnBalance).toBe(balance);
    expect((await sendTestAlert({ requestId: key(3), amount: 0 })).status).toBe("INVALID");
    expect((await sendTestAlert({ requestId: "short", amount: 1000 })).status).toBe("INVALID");
  });

  it("advances by display time, and respects pause, skip, cancel and the minimum amount", async () => {
    vi.useFakeTimers({ now: new Date("2026-09-29T12:00:00Z"), toFake: ["Date"] });
    const { sendTestAlert, setAlertControls, skipCurrentAlert, cancelAllAlerts, getOverlayAlert, getRemoteView, replayAlert, overlayKey } = await load();
    await setAlertControls({ displaySec: 5 });
    await sendTestAlert({ requestId: key(1), amount: 1_000, donor: "A" });
    await sendTestAlert({ requestId: key(2), amount: 2_000, donor: "B" });
    expect(await getOverlayAlert(overlayKey)).toMatchObject({ alert: { donor: "A", endsAt: "2026-09-29T12:00:05.000Z" } });
    vi.setSystemTime(new Date("2026-09-29T12:00:05Z"));
    expect(await getOverlayAlert(overlayKey)).toMatchObject({ alert: { donor: "B" } });

    await skipCurrentAlert();
    expect(await getOverlayAlert(overlayKey)).toMatchObject({ alert: null });

    await setAlertControls({ paused: true });
    await sendTestAlert({ requestId: key(3), amount: 3_000, donor: "C" });
    expect(await getOverlayAlert(overlayKey)).toMatchObject({ alert: null });
    await setAlertControls({ paused: false });
    expect(await getOverlayAlert(overlayKey)).toMatchObject({ alert: { donor: "C" } });

    await sendTestAlert({ requestId: key(4), amount: 4_000, donor: "D" });
    await cancelAllAlerts();
    let view = (await getRemoteView())!;
    expect(view.showing).toBeNull();
    expect(view.queued).toEqual([]);

    await setAlertControls({ minFn: 10_000 });
    await sendTestAlert({ requestId: key(5), amount: 9_999, donor: "E" });
    view = (await getRemoteView())!;
    expect(view.recent[0]).toMatchObject({ donor: "E", status: "FILTERED" });

    // Replay re-queues a finished alert (display only).
    await setAlertControls({ minFn: 0 });
    const a = view.recent.find((r) => r.donor === "A")!;
    expect(await replayAlert(a.id)).toEqual({ status: "SAVED" });
    expect(await getOverlayAlert(overlayKey)).toMatchObject({ alert: { donor: "A" } });
    expect((await setAlertControls({ displaySec: 1 })).status).toBe("INVALID");
    expect((await setAlertControls({ alertVolume: 101 })).status).toBe("INVALID");
  });

  it("queues donations to the studio channel only", async () => {
    const { enqueueDonationAlert, getRemoteView } = await load();
    enqueueDonationAlert("c1", { donor: "x", message: "", fnAmount: 1000, typeLabel: "텍스트" });
    expect((await getRemoteView())!.showing).toBeNull();
    enqueueDonationAlert("studio", { donor: "홍길동", message: "응원해요", fnAmount: 1000, typeLabel: "텍스트" });
    expect((await getRemoteView())!.showing).toMatchObject({ kind: "DONATION", donor: "홍길동" });
  });

  it("sends TTS-skip and overlay-reload signals to open overlays", async () => {
    const { skipTts, reloadOverlays, getOverlayAlert, overlayKey } = await load();
    const tools = await import("./broadcastTools");
    expect(await getOverlayAlert(overlayKey)).toMatchObject({ ttsSkipSeq: 0, reloadSeq: 0 });
    await skipTts();
    await reloadOverlays();
    expect(await getOverlayAlert(overlayKey)).toMatchObject({ ttsSkipSeq: 1, reloadSeq: 1 });
    expect(await tools.getOverlayTool("timer", overlayKey)).toMatchObject({ reloadSeq: 1 });
    signIn(["SUPPORTER"]);
    expect(await reloadOverlays()).toEqual({ status: "UNAUTHORIZED" });
  });

  it("rejects non-creators and wrong overlay keys", async () => {
    const { getOverlayAlert, sendTestAlert, cancelAllAlerts, getRemoteView } = await load();
    expect(await getOverlayAlert("wrong")).toBe("FORBIDDEN");
    signIn(["SUPPORTER"]);
    expect(await sendTestAlert({ requestId: key(1), amount: 1000 })).toEqual({ status: "UNAUTHORIZED" });
    expect(await cancelAllAlerts()).toEqual({ status: "UNAUTHORIZED" });
    expect(await getRemoteView()).toBeNull();
  });
});
