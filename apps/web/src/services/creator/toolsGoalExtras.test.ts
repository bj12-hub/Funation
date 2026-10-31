import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { timerSeconds } from "@/features/creatorStudio/widgets/timerMath";
import { mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import type { AlertItem } from "./alertTypes";
import { goalProgress, raisedGoal } from "./widgetOverlayCore";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 2026-10-23 (StreamDonate 참고, P1-5): 후원목표 자동 증량 · 타이머 후원 연동 · 텍스트 슬롯. */
async function load() {
  const tools = await import("./broadcastTools");
  const alerts = await import("./alertCore");
  const remote = await import("./alertRemote");
  const { mockCreator } = await import("./mockCreatorStore");
  return { ...tools, ...alerts, ...remote, overlayKey: mockCreator.integrationKey };
}

const slot = (patch: Record<string, unknown> = {}) => ({
  slot: 1,
  name: "",
  text: "공지",
  size: 32,
  color: "#ffffff",
  bold: true,
  outline: true,
  background: "NONE",
  align: "LEFT",
  scroll: false,
  scrollSec: 20,
  ...patch
});

describe("후원목표 자동 증량", () => {
  it("raises a reached goal by whole steps until it is ahead again", () => {
    expect(raisedGoal(100_000, 99_999, 50_000)).toBe(100_000);
    expect(raisedGoal(100_000, 100_000, 50_000)).toBe(150_000);
    expect(raisedGoal(100_000, 260_000, 50_000)).toBe(300_000);
    expect(raisedGoal(100_000, 260_000, 0)).toBe(100_000); // off
    // A fixed instant: the goal period is in Korea days (15:00 KST = 06:00 UTC, the same date in both).
    const day = "2026-10-23";
    const items: AlertItem[] = [{ id: "g1", kind: "DONATION", donor: "달빛", message: "", fnAmount: 120_000, typeLabel: "텍스트 후원", createdAt: "2026-10-23T06:00:00.000Z", status: "DONE" }];
    const s = { startAmount: 0, goalAmount: 100_000, from: day, to: day };
    expect(goalProgress(items, { ...s, autoRaise: 30_000 })).toMatchObject({ current: 120_000, target: 130_000, percent: 92.3 });
    expect(goalProgress(items, s)).toMatchObject({ target: 100_000, percent: 100 });
  });

  it("saves the step with the goal (0 when a payload has none)", async () => {
    resetMockStores();
    const { saveWidgetSettings, getWidgetDetail } = await import("./widgetSettings");
    const { DEFAULT_WIDGET_SETTINGS } = await import("./widgetSettingsTypes");
    const before: Record<string, unknown> = { ...DEFAULT_WIDGET_SETTINGS.GOAL };
    delete before.autoRaise;
    expect(await saveWidgetSettings("GOAL", before)).toEqual({ status: "SAVED" });
    expect((await getWidgetDetail("GOAL"))!.settings).toMatchObject({ autoRaise: 0 });
    expect(await saveWidgetSettings("GOAL", { ...before, autoRaise: 50_000 })).toEqual({ status: "SAVED" });
    expect((await getWidgetDetail("GOAL"))!.settings).toMatchObject({ autoRaise: 50_000 });
    expect((await saveWidgetSettings("GOAL", { ...before, autoRaise: -1 })).status).toBe("INVALID");
  });
});

describe("타이머 후원 연동", () => {
  beforeEach(() => {
    resetMockStores();
    vi.useFakeTimers({ now: new Date("2026-10-23T06:00:00Z"), toFake: ["Date"] });
  });
  afterEach(() => vi.useRealTimers());

  it("adds seconds per whole 1,000 FN of a completed donation to a countdown, once set", async () => {
    const m = await load();
    const shown = async () => {
      const t = await m.getOverlayTool("timer", m.overlayKey);
      if (t === "FORBIDDEN" || t.tool !== "timer") throw new Error("expected timer");
      return timerSeconds(t.state, Date.now());
    };
    const donate = (fnAmount: number, extra: Record<string, unknown> = {}) => m.enqueueDonationAlert("studio", { donor: "달빛", donorKey: null, message: "", fnAmount, typeLabel: "텍스트 후원", ...extra });
    await m.configureTimer({ mode: "COUNTDOWN", durationSec: 600 });
    donate(5_000); // off by default
    expect(await shown()).toBe(600);

    expect(await m.setTimerDonationLink(30)).toEqual({ status: "SAVED" });
    await m.controlTimer("START");
    vi.setSystemTime(new Date("2026-10-23T06:01:00Z"));
    donate(2_500); // 2 × 30 s
    expect(await shown()).toBe(600 - 60 + 60);
    donate(900); // under 1,000 FN
    donate(9_000, { questId: "q-1" }); // a quest is held until it succeeds
    m.enqueueDonationAlert("c4", { donor: "다른 방", donorKey: null, message: "", fnAmount: 9_000, typeLabel: "텍스트 후원" }); // another channel
    expect(await shown()).toBe(600);

    await m.configureTimer({ mode: "COUNTDOWN", durationSec: 120 }); // keeps the link
    expect((await m.getToolsView())!.states.timer).toMatchObject({ durationSec: 120, donationSec: 30 });
    await m.configureTimer({ mode: "STOPWATCH", durationSec: 600 });
    donate(10_000); // a stopwatch takes no time
    expect(await shown()).toBe(0);

    for (const bad of [-1, 601, 1.5, "30"]) expect((await m.setTimerDonationLink(bad)).status).toBe("INVALID");
    signIn(["SUPPORTER"]);
    expect(await m.setTimerDonationLink(10)).toEqual({ status: "UNAUTHORIZED" });
  });
});

describe("텍스트 슬롯", () => {
  beforeEach(() => resetMockStores());

  it("saves each slot on its own and shows it at its own address", async () => {
    const m = await load();
    expect(await m.saveTextSlot(slot({ slot: 3, name: " 공지 ", text: "  오늘 방송\r\n9시까지!  ", color: "#ffcc00", background: "CARD", align: "CENTER", scroll: true, scrollSec: 30 }))).toEqual({ status: "SAVED" });
    const view = await m.getOverlayTool("text", m.overlayKey, "3");
    expect(view !== "FORBIDDEN" && view.tool === "text" && view).toMatchObject({
      slot: 3,
      state: { name: "공지", text: "오늘 방송\n9시까지!", color: "#FFCC00", background: "CARD", align: "CENTER", scroll: true, scrollSec: 30 }
    });
    // No slot = 1 (empty: nothing on stream); outside 1 … 20 looks like a missing page.
    expect(await m.getOverlayTool("text", m.overlayKey)).toMatchObject({ slot: 1, state: { text: "" } });
    for (const bad of ["0", "21", "x"]) expect(await m.getOverlayTool("text", m.overlayKey, bad)).toBe("FORBIDDEN");

    // The 자막 switch of 기능 제어 covers the text slots too.
    expect(await m.setOverlaySwitch({ target: "subtitle", on: false })).toEqual({ status: "SAVED" });
    expect(await m.getOverlayTool("text", m.overlayKey, "3")).toMatchObject({ on: false });

    const bad: [Record<string, unknown>, string][] = [
      [{ slot: 21 }, "슬롯"],
      [{ name: "가".repeat(21) }, "슬롯 이름"],
      [{ text: "가".repeat(301) }, "300자"],
      [{ text: "운영자 공지" }, "사용할 수 없는"],
      [{ size: 33 }, "글자 크기"],
      [{ color: "yellow" }, "글자색"],
      [{ bold: "yes" }, "설정"],
      [{ background: "IMAGE" }, "배경"],
      [{ align: "JUSTIFY" }, "정렬"],
      [{ scrollSec: 4 }, "스크롤 시간"],
      [{ font: "Comic Sans" }, "폰트"],
      [{ lineHeight: 0.9 }, "줄 간격"],
      [{ lineHeight: 1.234 }, "줄 간격"],
      [{ outlineWidth: 0 }, "테두리"],
      [{ outlineWidth: 11 }, "테두리"],
      [{ outlineColor: "black" }, "테두리"],
      [{ shadow: "yes" }, "설정"],
      [{ bgColor: "red" }, "배경색"],
      [{ padding: 81 }, "안쪽 여백"],
      [{ radius: -1 }, "모서리"]
    ];
    for (const [patch, message] of bad) {
      const res = await m.saveTextSlot(slot(patch));
      expect(res.status === "INVALID" && res.message, message).toContain(message);
    }
    signIn(["SUPPORTER"]);
    expect(await m.saveTextSlot(slot())).toEqual({ status: "UNAUTHORIZED" });
  });

  it("keeps each slot's style — 폰트 · 줄 간격 · 테두리 · 그림자 · 색 지정 배경 (2026-10-28) — and older screens leave it as saved", async () => {
    const m = await load();
    const shown = async () => {
      const view = await m.getOverlayTool("text", m.overlayKey, "2");
      if (view === "FORBIDDEN" || view.tool !== "text") throw new Error("expected text");
      return view.state;
    };
    // A new slot looks as slots did before: 테마 글꼴, a 2px black outline, no shadow.
    expect(await shown()).toMatchObject({ font: null, lineHeight: 1.35, outlineWidth: 2, outlineColor: "#000000", shadow: false, bgColor: "#000000", padding: 18, radius: 12 });
    const style = { font: "Pretendard", lineHeight: 1.8, outlineWidth: 4, outlineColor: "#ff0066", shadow: true, background: "COLOR", bgColor: "#112233", padding: 24, radius: 0 };
    expect(await m.saveTextSlot(slot({ slot: 2, text: "공지", ...style }))).toEqual({ status: "SAVED" });
    expect(await shown()).toMatchObject({ ...style, outlineColor: "#FF0066", bgColor: "#112233" });
    // A screen from before sends none of them: the slot keeps them.
    expect(await m.saveTextSlot(slot({ slot: 2, text: "다시 공지", background: "COLOR" }))).toEqual({ status: "SAVED" });
    expect(await shown()).toMatchObject({ text: "다시 공지", font: "Pretendard", lineHeight: 1.8, outlineWidth: 4, shadow: true, padding: 24, radius: 0 });
    expect(await m.saveTextSlot(slot({ slot: 2, text: "공지", font: null }))).toEqual({ status: "SAVED" });
    expect((await shown()).font).toBeNull();
  });
});
