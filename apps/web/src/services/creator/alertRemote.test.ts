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

  it("reloads one overlay at a time (기능별 새로고침) on top of the reload-all signal", async () => {
    const { reloadOverlays, getOverlayAlert, getOverlaySignal, overlayKey } = await load();
    const tools = await import("./broadcastTools");
    expect(await reloadOverlays({ target: "timer" })).toEqual({ status: "SAVED" });
    expect(await tools.getOverlayTool("timer", overlayKey)).toMatchObject({ reloadSeq: 1 });
    expect(await tools.getOverlayTool("subtitle", overlayKey)).toMatchObject({ reloadSeq: 0 });
    expect(await getOverlayAlert(overlayKey)).toMatchObject({ reloadSeq: 0 });
    await reloadOverlays({ target: "crew" });
    expect(await getOverlaySignal(overlayKey, "crew")).toMatchObject({ reloadSeq: 1, on: true });
    expect(await getOverlaySignal(overlayKey, "chat")).toMatchObject({ reloadSeq: 0, on: true });
    await reloadOverlays();
    expect(await getOverlaySignal(overlayKey, "chat")).toMatchObject({ reloadSeq: 1, on: true });
    expect(await tools.getOverlayTool("timer", overlayKey)).toMatchObject({ reloadSeq: 2 });
    expect((await reloadOverlays({ target: "nope" })).status).toBe("INVALID");
    expect(await getOverlaySignal("wrong-key", "chat")).toBe("FORBIDDEN");
    expect(await getOverlaySignal(overlayKey, "nope")).toBe("FORBIDDEN");
  });

  it("switches one overlay OFF and ON (기능 제어) and sets the video volume", async () => {
    const { setOverlaySwitch, setVideoVolume, getRemoteView, getOverlayAlert, getOverlaySignal, getOverlaySwitches, overlayKey } = await load();
    const tools = await import("./broadcastTools");
    const media = await import("./media");
    expect((await getRemoteView())!.overlays.on).toMatchObject({ alert: true, timer: true, crew: true });
    expect(await setOverlaySwitch({ target: "timer", on: false })).toEqual({ status: "SAVED" });
    expect(await setOverlaySwitch({ target: "timer", on: false })).toEqual({ status: "SAVED" }); // same value twice
    expect(await tools.getOverlayTool("timer", overlayKey)).toMatchObject({ on: false });
    expect(await tools.getOverlayTool("subtitle", overlayKey)).toMatchObject({ on: true });
    expect(await getOverlayAlert(overlayKey)).toMatchObject({ on: true });
    await setOverlaySwitch({ target: "crew", on: false });
    expect(await getOverlaySignal(overlayKey, "crew")).toMatchObject({ on: false });
    expect((await getRemoteView())!.overlays.on).toMatchObject({ timer: false, crew: false, chat: true });
    expect(await getOverlaySwitches()).toMatchObject({ timer: false, crew: false, chat: true, alert: true }); // 오버레이 주소 page
    await setOverlaySwitch({ target: "timer", on: true });
    expect(await tools.getOverlayTool("timer", overlayKey)).toMatchObject({ on: true });
    expect((await setOverlaySwitch({ target: "timer", on: "yes" })).status).toBe("INVALID");
    expect((await setOverlaySwitch({ target: "nope", on: true })).status).toBe("INVALID");

    expect(await setVideoVolume({ volume: 35 })).toEqual({ status: "SAVED" });
    expect((await getRemoteView())!.overlays.videoVolume).toBe(35);
    expect(await media.getOverlayVideo(overlayKey)).toMatchObject({ volume: 35, on: true });
    expect((await setVideoVolume({ volume: 101 })).status).toBe("INVALID");
    signIn(["SUPPORTER"]);
    expect(await setOverlaySwitch({ target: "timer", on: false })).toEqual({ status: "UNAUTHORIZED" });
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
