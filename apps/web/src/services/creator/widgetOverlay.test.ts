import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores } from "@/test/mockEnv";
import type { AlertItem } from "./alertTypes";
import { eventLines, goalProgress, rankingRows, recentLines, totalAmount } from "./widgetOverlayCore";
import { DEFAULT_WIDGET_SETTINGS } from "./widgetSettingsTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

const D = DEFAULT_WIDGET_SETTINGS;
let n = 0;
const alert = (at: string, donor: string, fnAmount: number, extra: Partial<AlertItem> = {}): AlertItem => ({
  id: `a${++n}`,
  kind: "DONATION",
  donor,
  message: "",
  fnAmount,
  typeLabel: "일반 후원",
  createdAt: new Date(at).toISOString(),
  status: "DONE",
  ...extra
});

/** 후원 위젯 overlays (code-first): numbers from the donation feed, settings from 위젯 settings. */
describe("후원 위젯 계산", () => {
  const feed = [
    alert("2026-09-30T23:30:00", "별빛", 30_000),
    alert("2026-10-01T10:00:00", "치즈냥", 10_000),
    alert("2026-10-02T09:00:00", "별빛", 5_000),
    alert("2026-10-02T12:00:00", "익명", 50_000),
    alert("2026-10-03T08:00:00", "테스트 후원자", 99_000, { kind: "TEST" }),
    alert("2026-10-03T09:00:00", "유튜버팬", 0, { kind: "EXTERNAL", platform: "YOUTUBE", amountLabel: "₩5,000" }),
    alert("2026-10-03T09:30:00", "치즈냥", 10_000)
  ];
  const now = new Date("2026-10-03T12:00:00");

  it("sums Somnation donations only for 목표 · 누적 (test and platform donations never count)", () => {
    const goal = goalProgress(feed, { ...D.GOAL, startAmount: 1_000, goalAmount: 100_000, from: "2026-10-01", to: "2026-10-05" }, now.getTime());
    expect(goal).toEqual({ current: 1_000 + 10_000 + 5_000 + 50_000 + 10_000, percent: 76, daysLeft: 3 });
    expect(goalProgress(feed, { ...D.GOAL, startAmount: 0, goalAmount: 10_000, from: "2026-09-01", to: "2026-12-31" }).percent).toBe(100);
    expect(totalAmount(feed, { ...D.TOTAL, from: "2026-10-02T09:00", to: "2026-10-02T12:00" })).toBe(55_000);
  });

  it("ranks donors by FN in the period, without 익명", () => {
    const ranking = (period: (typeof D.RANKING)["period"], ranks = 5) => rankingRows(feed, { ...D.RANKING, period, ranks }, now).map((r) => [r.rank, r.name, r.fnAmount]);
    expect(ranking("전체")).toEqual([
      [1, "별빛", 35_000],
      [2, "치즈냥", 20_000]
    ]);
    expect(ranking("월간")).toEqual([
      [1, "치즈냥", 20_000],
      [2, "별빛", 5_000]
    ]);
    expect(ranking("일간")).toEqual([[1, "치즈냥", 10_000]]);
    expect(ranking("전체", 1)).toHaveLength(1);
  });

  it("writes 최근알림 lines newest first with each platform's template", () => {
    const lines = recentLines(feed, { ...D.RECENT, count: 3 });
    expect(lines.map((l) => [l.nickname, l.platform, `${l.before}${l.nickname}${l.after}`])).toEqual([
      ["치즈냥", null, "치즈냥님이 10,000 FN 후원했습니다."],
      ["유튜버팬", "YOUTUBE", "유튜버팬님이 ₩5,000 후원했습니다."],
      ["테스트 후원자", null, "테스트 후원자님이 99,000 FN 후원했습니다."]
    ]);
    // A template asking for the platform's item count falls back to the default line (count mapping TBD).
    const soop = recentLines([alert("2026-10-03T10:00:00", "풍선러", 0, { kind: "EXTERNAL", platform: "SOOP", amountLabel: "₩1,000" })], D.RECENT)[0];
    expect(`${soop.before}${soop.nickname}${soop.after}`).toBe("풍선러님이 ₩1,000 후원했습니다.");
    // 치지직 (confirmed 2026-10-01) has its own line like the other platforms.
    const chzzk = recentLines([alert("2026-10-03T10:00:00", "치즈팬", 0, { kind: "EXTERNAL", platform: "CHZZK", amountLabel: "₩2,000" })], {
      ...D.RECENT,
      templates: { ...D.RECENT.templates, CHZZK: "치즈 {amount} 고마워요 {nickname}님" }
    })[0];
    expect([chzzk.before, chzzk.nickname, chzzk.after]).toEqual(["치즈 ₩2,000 고마워요 ", "치즈팬", "님"]);
    expect(eventLines(feed, { ...D.EVENT, maxLines: 2, order: "오래된순" }).map((l) => l.nickname)).toEqual(["유튜버팬", "치즈냥"]);
    expect(eventLines(feed, { ...D.EVENT, maxLines: 2, order: "최신순" }).map((l) => l.nickname)).toEqual(["치즈냥", "유튜버팬"]);
  });
});

describe("후원 위젯 오버레이", () => {
  beforeEach(() => resetMockStores());

  async function load() {
    const overlay = await import("./widgetOverlay");
    const remote = await import("./alertRemote");
    const widgets = await import("./widgetSettings");
    const { mockCreator } = await import("./mockCreatorStore");
    return { ...overlay, ...remote, ...widgets, overlayKey: mockCreator.integrationKey };
  }

  it("needs the integration key and a known widget, and reads the saved settings", async () => {
    const m = await load();
    expect(await m.getOverlayWidget("goal", "wrong-key")).toBe("FORBIDDEN");
    expect(await m.getOverlayWidget("luckybox", m.overlayKey)).toBe("FORBIDDEN");
    const total = await m.getOverlayWidget("total", m.overlayKey);
    if (total === "FORBIDDEN" || total.widget !== "total") throw new Error("total");
    expect(total.on).toBe(true);
    expect(total.total).toBeGreaterThan(0); // the seeded donation history

    const detail = (await m.getWidgetDetail("TOTAL"))!;
    expect(detail.overlayPath).toBe(`/overlay/widget/total/${m.overlayKey}`);
    expect((await m.getWidgetDetail("VOTE"))!.overlayPath).toBe(`/overlay/widget/vote/${m.overlayKey}`);
    expect((await m.getWidgetDetail("LUCKYBOX"))!.overlayPath).toBeNull();
    expect(await m.saveWidgetSettings("TOTAL", { ...detail.settings, title: "이번 달 후원" })).toEqual({ status: "SAVED" });
    const saved = await m.getOverlayWidget("total", m.overlayKey);
    expect(saved !== "FORBIDDEN" && saved.widget === "total" && saved.settings.title).toBe("이번 달 후원");
  });

  it("reads 최근알림 settings saved before 치지직 with the default 치지직 line", async () => {
    const m = await load();
    const { widgetStore } = await import("./widgetStore");
    const old: Record<string, string> = { ...widgetStore.RECENT.templates };
    delete old.CHZZK;
    widgetStore.RECENT.templates = old as typeof widgetStore.RECENT.templates;
    const detail = (await m.getWidgetDetail("RECENT"))!;
    expect((detail.settings as typeof D.RECENT).templates.CHZZK).toBe(D.RECENT.templates.CHZZK);
    expect(await m.saveWidgetSettings("RECENT", detail.settings)).toEqual({ status: "SAVED" });
    const overlay = await m.getOverlayWidget("recent", m.overlayKey);
    expect(overlay !== "FORBIDDEN" && overlay.widget === "recent" && overlay.settings.templates.CHZZK).toBe(D.RECENT.templates.CHZZK);
  });

  it("follows the 리모컨 후원 위젯 switch and 새로고침", async () => {
    const m = await load();
    expect(await m.setOverlaySwitch({ target: "widgets", on: false })).toEqual({ status: "SAVED" });
    const off = await m.getOverlayWidget("ranking", m.overlayKey);
    expect(off !== "FORBIDDEN" && off.on).toBe(false);
    const before = off !== "FORBIDDEN" ? off.reloadSeq : -1;
    await m.reloadOverlays({ target: "widgets", requestId: key(1) });
    const after = await m.getOverlayWidget("qr", m.overlayKey);
    expect(after !== "FORBIDDEN" && after.reloadSeq).toBeGreaterThan(before);
    await m.setOverlaySwitch({ target: "widgets", on: true });
  });
});
