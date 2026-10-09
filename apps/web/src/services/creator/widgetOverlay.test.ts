import { beforeEach, describe, expect, it, vi } from "vitest";
import { fillRank } from "./widgetOverlayCore";
import { formatMoney } from "./donationLinkTypes";
import { key, mockSessionModule, resetMockStores } from "@/test/mockEnv";
import type { AlertItem } from "./alertTypes";
import { crewRankingRows, eventLines, goalProgress, rankAmountText, rankingRows, recentLines, sourceBoardRows, totalAmount } from "./widgetOverlayCore";
import { DEFAULT_WIDGET_SETTINGS } from "./widgetSettingsTypes";
import { wallStickers } from "./wallpaperCore";

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

/** 후원랭킹 위젯 랭킹 종류 (code-first, 2026-10-06): 크루 후원 순위 and 수단별 보드. */
describe("랭킹 종류", () => {
  const now = new Date("2026-10-03T12:00:00");
  const at = (d: string) => new Date(d).toISOString();

  it("ranks crew members by FN donated for them in the period, leaving out other members and older donations", () => {
    const members = [
      { id: "m1", name: "하루" },
      { id: "m2", name: "도도" },
      { id: "m3", name: "밤톨" }
    ];
    const attributions = [
      { memberId: "m1", fnAmount: 5_000, at: at("2026-10-01T10:00:00") },
      { memberId: "m2", fnAmount: 9_000, at: at("2026-10-02T10:00:00") },
      { memberId: "m1", fnAmount: 6_000, at: at("2026-10-03T10:00:00") },
      { memberId: "gone", fnAmount: 99_000, at: at("2026-10-03T10:00:00") }, // removed member
      { memberId: "m3", fnAmount: 50_000, at: at("2026-09-20T10:00:00") } // last month
    ];
    const rows = crewRankingRows(attributions, members, { period: "월간", ranks: 5 }, now);
    expect(rows.map((r) => [r.rank, r.name, r.fnAmount])).toEqual([
      [1, "하루", 11_000],
      [2, "도도", 9_000]
    ]);
    expect(crewRankingRows(attributions, members, { period: "전체", ranks: 1 }, now).map((r) => r.name)).toEqual(["밤톨"]);
  });

  it("boards Ssumnation FN and each platform in its own unit by 건수, never mixing units or counting tests", () => {
    const item = (kind: AlertItem["kind"], extra: Partial<AlertItem> = {}): AlertItem => alert("2026-10-03T09:00:00", "누군가", kind === "DONATION" ? 1_000 : 0, { kind, ...extra });
    const feed = [
      item("DONATION"),
      item("DONATION"),
      item("TEST", { fnAmount: 50_000 }),
      item("EXTERNAL", { platform: "SOOP", native: { value: 10, unit: "SOOP_BALLOON" } }),
      item("EXTERNAL", { platform: "SOOP", native: { value: 30, unit: "SOOP_BALLOON" } }),
      item("EXTERNAL", { platform: "SOOP", native: { value: 5, unit: "SOOP_BALLOON" } }),
      item("EXTERNAL", { platform: "YOUTUBE", native: { value: 5_000, unit: "KRW" } }),
      item("EXTERNAL", { platform: "YOUTUBE", native: { value: 3, unit: "USD" } }),
      item("EXTERNAL", { platform: "CHZZK" }) // no native amount (older alert): skipped
    ];
    const rows = sourceBoardRows(feed, { period: "월간", ranks: 10 }, now);
    expect(rows.map((r) => [r.rank, r.name])).toEqual([
      [1, "SOOP · 3건"],
      [2, "썸네이션 FN · 2건"],
      [3, "YouTube KRW · 1건"],
      [4, "YouTube USD · 1건"]
    ]);
    expect(rows[0].amountLabel).toBe("45 별풍선");
    expect(rows[1]).toMatchObject({ fnAmount: 2_000, amountLabel: "2,000 FN" });
    expect(rankAmountText("{amount}FN", rows[0])).toBe("45 별풍선");
    expect(rankAmountText("{amount}FN", { rank: 1, name: "a", fnAmount: 1_500 })).toBe("1,500FN");
  });

  it("groups alerts stored before unit codes (label) with new ones, labelled the same", () => {
    const item = (platform: AlertItem["platform"], native: unknown): AlertItem => alert("2026-10-03T09:00:00", "누군가", 0, { kind: "EXTERNAL", platform, native: native as AlertItem["native"] });
    const rows = sourceBoardRows(
      [
        item("CHZZK", { value: 1_000, currency: "치즈" }), // stored before the codes
        item("CHZZK", { value: 2_000, unit: "CHZZK_CHEESE" }),
        item("FLEXTV", { value: 7, currency: "FlexTV 후원" }),
        item("FLEXTV", { value: 3, unit: "FLEXTV_UNIT" }),
        item("SOOP", { value: 4, currency: "별풍선" }),
        item("YOUTUBE", { value: 5_000, currency: "KRW" }),
        item("YOUTUBE", { value: 5, unit: "EUR" }) // a currency outside the list: its own line, shown as money
      ],
      { period: "월간", ranks: 10 },
      now
    );
    expect(rows.map((r) => [r.name, r.amountLabel])).toEqual([
      ["치지직 · 2건", "3,000 치즈"],
      ["FlexTV · 2건", "10 FlexTV 후원"],
      ["YouTube EUR · 1건", formatMoney(5, "EUR")],
      ["YouTube KRW · 1건", formatMoney(5_000, "KRW")],
      ["SOOP · 1건", "4 별풍선"]
    ]);
  });

  it("reads settings saved before the boards as 후원자 랭킹 and rejects unknown boards", async () => {
    const { PARSERS } = await import("./widgetParsers");
    const { board: _drop, ...old } = D.RANKING;
    void _drop;
    expect(PARSERS.RANKING(old)).toMatchObject({ board: "DONOR" });
    expect(PARSERS.RANKING({ ...D.RANKING, board: "SOURCE" })).toMatchObject({ board: "SOURCE" });
    expect(typeof PARSERS.RANKING({ ...D.RANKING, board: "LUCKY" })).toBe("string");
  });
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

  it("sums Ssumnation donations only for 목표 · 누적 (test and platform donations never count)", () => {
    const goal = goalProgress(feed, { ...D.GOAL, startAmount: 1_000, goalAmount: 100_000, from: "2026-10-01", to: "2026-10-05" }, now.getTime());
    expect(goal).toEqual({ current: 1_000 + 10_000 + 5_000 + 50_000 + 10_000, percent: 76, daysLeft: 3 });
    expect(goalProgress(feed, { ...D.GOAL, startAmount: 0, goalAmount: 10_000, from: "2026-09-01", to: "2026-12-31" }).percent).toBe(100);
    expect(totalAmount(feed, { ...D.TOTAL, from: "2026-10-02T09:00", to: "2026-10-02T12:00" })).toBe(55_000);
  });

  it("never counts or lists a 다시 보내기 copy as another donation", () => {
    const replays = [
      alert("2026-10-03T10:00:00", "별빛", 5_000, { id: "rp-1", replayOf: "al-1" }),
      alert("2026-10-03T10:05:00", "유튜버팬", 0, { id: "rp-2", kind: "EXTERNAL", platform: "YOUTUBE", native: { value: 5_000, unit: "KRW" }, replayOf: "al-2" })
    ];
    const all = [...feed, ...replays];
    const range = { ...D.TOTAL, from: "2026-10-01T00:00", to: "2026-10-05T23:59" };
    expect(totalAmount(all, range)).toBe(totalAmount(feed, range));
    expect(rankingRows(all, { ...D.RANKING, period: "전체", ranks: 5 }, now)).toEqual(rankingRows(feed, { ...D.RANKING, period: "전체", ranks: 5 }, now));
    expect(sourceBoardRows(all, { period: "전체", ranks: 5 }, now)).toEqual(sourceBoardRows(feed, { period: "전체", ranks: 5 }, now));
    expect(recentLines(all, { ...D.RECENT, count: 3 })).toEqual(recentLines(feed, { ...D.RECENT, count: 3 }));
    expect(eventLines(all, { ...D.EVENT, maxLines: 3 })).toEqual(eventLines(feed, { ...D.EVENT, maxLines: 3 }));
    expect(wallStickers(all, { images: [] }, null).map((x) => x.id)).not.toContain("rp-1"); // no second 벽지 sticker
  });

  it("counts a 퀘스트 후원 only once it succeeded (held until then, refunded on 실패 · 취소)", () => {
    const quests = [
      alert("2026-10-03T10:00:00", "퀘스터", 20_000, { questId: "q-run" }),
      alert("2026-10-03T10:30:00", "퀘스터", 40_000, { questId: "q-won", questSucceeded: true }),
      alert("2026-10-03T11:00:00", "퀘스터", 80_000, { questId: "q-lost" })
    ];
    const all = [...feed, ...quests];
    const range = { ...D.TOTAL, from: "2026-10-03T00:00", to: "2026-10-03T23:59" };
    expect(totalAmount(all, range) - totalAmount(feed, range)).toBe(40_000);
    expect(rankingRows(all, { ...D.RANKING, period: "일간", ranks: 5 }, now)).toEqual([
      { rank: 1, name: "퀘스터", fnAmount: 40_000 },
      { rank: 2, name: "치즈냥", fnAmount: 10_000 }
    ]);
    expect(sourceBoardRows(all, { period: "일간", ranks: 5 }, now)).toEqual([expect.objectContaining({ name: "썸네이션 FN · 2건", fnAmount: 50_000 })]);
  });

  it("counts a succeeded 퀘스트 후원 at its success time (2026-10-08 결정)", () => {
    const won = alert("2026-10-02T23:00:00", "퀘스터", 40_000, { questId: "q-late", questSucceeded: true, questSucceededAt: new Date("2026-10-03T09:00:00").toISOString() });
    const day = (d: string) => ({ ...D.TOTAL, from: `${d}T00:00`, to: `${d}T23:59` });
    expect(totalAmount([won], day("2026-10-03"))).toBe(40_000);
    expect(totalAmount([won], day("2026-10-02"))).toBe(0);
    expect(goalProgress([won], { ...D.GOAL, startAmount: 0, from: "2026-10-03", to: "2026-10-03" }).current).toBe(40_000);
    expect(rankingRows([won], { ...D.RANKING, period: "일간", ranks: 5 }, now)).toEqual([{ rank: 1, name: "퀘스터", fnAmount: 40_000 }]);
    expect(sourceBoardRows([won], { period: "일간", ranks: 5 }, now)).toHaveLength(1);
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

  it("groups 후원랭킹 rows by donor key (latest name shown), never by a copyable name", () => {
    const keyed = [
      alert("2026-10-03T09:00:00", "별빛", 1_000, { donorKey: "dk-copycat" }), // copies the top donor's name
      alert("2026-10-03T09:10:00", "새벽", 2_000, { donorKey: "dk-a" }),
      alert("2026-10-03T09:20:00", "새벽별명", 3_000, { donorKey: "dk-a" }),
      alert("2026-10-03T09:30:00", "응원 고마워요", 90_000, { donorKey: null }) // 프로필 숨기기, whatever name shows
    ];
    const rows = rankingRows([...feed, ...keyed], { ...D.RANKING, period: "전체", ranks: 5 }, now).map((r) => [r.name, r.fnAmount]);
    expect(rows).toEqual([
      ["별빛", 35_000],
      ["치즈냥", 20_000],
      ["새벽별명", 5_000],
      ["별빛", 1_000]
    ]);
    // A keyed alert shown as 익명 (후원 필터링 replaced the name) is left out too, not grouped under its key.
    const filtered = alert("2026-10-03T09:40:00", "익명", 500_000, { donorKey: "dk-filtered" });
    expect(rankingRows([...feed, ...keyed, filtered], { ...D.RANKING, period: "전체", ranks: 5 }, now).map((r) => r.name)).not.toContain("익명");
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
    expect(await m.getOverlayWidget("nope", m.overlayKey)).toBe("FORBIDDEN");
    const total = await m.getOverlayWidget("total", m.overlayKey);
    if (total === "FORBIDDEN" || total.widget !== "total") throw new Error("total");
    expect(total.on).toBe(true);
    expect(total.total).toBeGreaterThan(0); // the seeded donation history

    const detail = (await m.getWidgetDetail("TOTAL"))!;
    expect(detail.overlayPath).toBe(`/overlay/widget/total/${m.overlayKey}`);
    expect((await m.getWidgetDetail("VOTE"))!.overlayPath).toBe(`/overlay/widget/vote/${m.overlayKey}`);
    expect((await m.getWidgetDetail("CHAT"))!.overlayPath).toBe(`/overlay/chat/${m.overlayKey}`);
    expect((await m.getWidgetDetail("MINI"))!.overlayPath).toBe(`/overlay/widget/mini/${m.overlayKey}`);
    expect((await m.getWidgetDetail("CUSTOM_SOUND"))!.overlayPath).toBeNull();
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

describe("후원랭킹 위젯 · 수단별 보드 표시", () => {
  beforeEach(() => resetMockStores());

  it("fills {amount} with a row's own unit and groups digits in platform units", () => {
    expect(fillRank("{name} ({amount})", 2, "SOOP · 3건", 0, "30,000 별풍선")).toBe("SOOP · 3건 (30,000 별풍선)");
    expect(fillRank("{rank}위 {amount}", 1, "a", 12_000)).toBe("1위 12,000");
    expect(formatMoney(30_000, "치즈")).toBe("30,000 치즈");
  });

  it("reads 랭킹 종류 as 후원자 랭킹 for settings saved before it existed, and previews 크루 후원 순위 per 기간", async () => {
    const { widgetStore, readWidget } = await import("./widgetStore");
    delete (widgetStore.RANKING as { board?: string }).board;
    expect(readWidget("RANKING").board).toBe("DONOR");
    const { getWidgetDetail } = await import("./widgetSettings");
    const detail = await getWidgetDetail("RANKING");
    if (!detail) throw new Error("no detail");
    expect(Object.keys(detail.live.crewRanking).sort()).toEqual(["일간", "월간", "전체", "주간"].sort());
  });
});
