import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { timerSeconds } from "@/features/creatorStudio/widgets/timerMath";
import { mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 방송 도구 (code-first): creator-only remote, key-guarded overlays, server-owned timer. */
async function load() {
  const tools = await import("./broadcastTools");
  const { mockCreator } = await import("./mockCreatorStore");
  return { ...tools, overlayKey: mockCreator.integrationKey };
}

describe("방송 도구", () => {
  beforeEach(() => resetMockStores());
  afterEach(() => vi.useRealTimers());

  it("shows saved subtitle and marquee on the overlay, and validates input", async () => {
    const { saveSubtitle, saveMarquee, getOverlayTool, overlayKey } = await load();
    expect(await saveSubtitle({ text: "  잠시 쉬어갈게요  ", size: "L" })).toEqual({ status: "SAVED" });
    expect(await getOverlayTool("subtitle", overlayKey)).toEqual({ tool: "subtitle", state: { text: "잠시 쉬어갈게요", size: "L" }, reloadSeq: 0, on: true });
    expect((await saveSubtitle({ text: "x".repeat(81), size: "M" })).status).toBe("INVALID");
    expect((await saveSubtitle({ text: "운영자 공지", size: "M" })).status).toBe("INVALID");
    expect((await saveSubtitle({ text: "hi", size: "XL" })).status).toBe("INVALID");

    expect(await saveMarquee({ lines: ["공지 1", " ", "공지 2"], speed: "FAST" })).toEqual({ status: "SAVED" });
    expect(await getOverlayTool("marquee", overlayKey)).toEqual({ tool: "marquee", state: { lines: ["공지 1", "공지 2"], speed: "FAST" }, reloadSeq: 0, on: true });
    expect((await saveMarquee({ lines: Array(6).fill("a"), speed: "FAST" })).status).toBe("INVALID");
  });

  it("keeps the timer on the server: start, pause, resume and reset", async () => {
    vi.useFakeTimers({ now: new Date("2026-09-29T12:00:00Z"), toFake: ["Date"] });
    const { configureTimer, controlTimer, getOverlayTool, overlayKey } = await load();
    expect(await configureTimer({ mode: "COUNTDOWN", durationSec: 300 })).toEqual({ status: "SAVED" });
    await controlTimer("START");
    await controlTimer("START"); // repeated start does not restart the clock
    vi.setSystemTime(new Date("2026-09-29T12:01:00Z"));
    await controlTimer("PAUSE");
    const paused = await getOverlayTool("timer", overlayKey);
    if (paused === "FORBIDDEN" || paused.tool !== "timer") throw new Error("expected timer");
    expect(paused.state).toMatchObject({ startedAt: null, elapsedBeforeSec: 60 });
    expect(timerSeconds(paused.state, Date.now())).toBe(240);

    await controlTimer("START");
    vi.setSystemTime(new Date("2026-09-29T12:10:00Z"));
    const running = await getOverlayTool("timer", overlayKey);
    if (running === "FORBIDDEN" || running.tool !== "timer") throw new Error("expected timer");
    expect(timerSeconds(running.state, Date.now())).toBe(0); // countdown never goes negative

    await controlTimer("RESET");
    expect(await getOverlayTool("timer", overlayKey)).toMatchObject({ state: { startedAt: null, elapsedBeforeSec: 0 } });
    expect((await configureTimer({ mode: "COUNTDOWN", durationSec: 0 })).status).toBe("INVALID");
    expect((await controlTimer("REWIND")).status).toBe("INVALID");
  });

  it("includes the crew ranking in the credits only when enabled", async () => {
    const { saveCredits, getOverlayTool, overlayKey } = await load();
    expect(await saveCredits({ title: "감사합니다", thanks: ["모두 고마워요"], includeCrew: true })).toEqual({ status: "SAVED" });
    const withCrew = await getOverlayTool("credits", overlayKey);
    if (withCrew === "FORBIDDEN" || withCrew.tool !== "credits") throw new Error("expected credits");
    expect(withCrew.crew.length).toBeGreaterThan(0);
    await saveCredits({ title: "감사합니다", thanks: [], includeCrew: false });
    expect(await getOverlayTool("credits", overlayKey)).toMatchObject({ crew: [] });
    expect((await saveCredits({ title: "", thanks: [], includeCrew: false })).status).toBe("INVALID");
  });

it("퀵 조정 moves the shown time in both modes, clamped at zero", async () => {
    vi.useFakeTimers({ now: new Date("2026-09-30T12:00:00Z"), toFake: ["Date"] });
    const { configureTimer, controlTimer, adjustTimer, getOverlayTool, overlayKey } = await load();
    const shown = async () => {
      const t = await getOverlayTool("timer", overlayKey);
      if (t === "FORBIDDEN" || t.tool !== "timer") throw new Error("expected timer");
      return timerSeconds(t.state, Date.now());
    };
    await configureTimer({ mode: "COUNTDOWN", durationSec: 120 });
    await controlTimer("START");
    vi.setSystemTime(new Date("2026-09-30T12:00:30Z"));
    expect(await shown()).toBe(90);
    await adjustTimer(60);
    expect(await shown()).toBe(150); // running countdown: more time left
    await adjustTimer(-60);
    await adjustTimer(-60);
    await adjustTimer(-60);
    expect(await shown()).toBe(0);
    await configureTimer({ mode: "STOPWATCH", durationSec: 600 });
    await adjustTimer(30);
    expect(await shown()).toBe(30);
    expect((await adjustTimer(45)).status).toBe("INVALID");
  });

  it("rolls the ending credits only between 시작 and 중지, keeping the roll across saves", async () => {
    const { controlCredits, saveCredits, getOverlayTool, overlayKey } = await load();
    expect(await getOverlayTool("credits", overlayKey)).toMatchObject({ state: { rollingSince: null } });
    await controlCredits("START");
    await saveCredits({ title: "감사합니다", thanks: ["또 만나요"], includeCrew: false });
    const rolling = await getOverlayTool("credits", overlayKey);
    if (rolling === "FORBIDDEN" || rolling.tool !== "credits") throw new Error("expected credits");
    expect(rolling.state.rollingSince).not.toBeNull();
    await controlCredits("STOP");
    expect(await getOverlayTool("credits", overlayKey)).toMatchObject({ state: { rollingSince: null } });
    expect((await controlCredits("PAUSE")).status).toBe("INVALID");
  });

  it("rejects wrong overlay keys, unknown tools and non-creators", async () => {
    const { getOverlayTool, saveSubtitle, getToolsView, controlTimer, overlayKey } = await load();
    expect(await getOverlayTool("subtitle", "wrong-key")).toBe("FORBIDDEN");
    expect(await getOverlayTool("chat", overlayKey)).toBe("FORBIDDEN");
    signIn(["SUPPORTER"]);
    expect(await saveSubtitle({ text: "hi", size: "M" })).toEqual({ status: "UNAUTHORIZED" });
    expect(await controlTimer("START")).toEqual({ status: "UNAUTHORIZED" });
    expect(await getToolsView()).toBeNull();
    signIn(null);
    expect(await getToolsView()).toBeNull();
  });
});
