import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import type { AlertItem } from "./alertTypes";
import { monitorLine, sigQueueCards, topDonation } from "./widgetOverlayCore";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 알림 모니터 (code-first, 2026-10-23): 최고 후원 · 후원 모니터링 · 시그 큐 모니터 read the 후원 알림 history and queue. */
const NOW = new Date("2026-10-23T05:00:00Z");
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString();
let n = 0;
const alert = (patch: Partial<AlertItem>): AlertItem => ({
  id: `a${++n}`,
  kind: "DONATION",
  donor: "후원자",
  message: "",
  fnAmount: 1_000,
  typeLabel: "텍스트 후원",
  createdAt: ago(1),
  status: "DONE",
  ...patch
});

describe("최고 후원", () => {
  const base = { period: "일간", timing: "RECEIVED", tie: "LATEST" } as const;

  it("takes the biggest counted donation of the period, with the name its alert showed", () => {
    const items = [
      alert({ donor: "어제왕", fnAmount: 900_000, createdAt: ago(60 * 30) }), // yesterday
      alert({ donor: "달빛", fnAmount: 50_000, message: "가즈아" }),
      alert({ donor: "익명", fnAmount: 70_000, donorKey: null }), // one donation: 익명 is a name like any other here
      alert({ kind: "TEST", donor: "테스트", fnAmount: 1_000_000 }), // tests never count
      alert({ donor: "다시", fnAmount: 2_000_000, replayOf: "a2" }), // a 다시 보내기 copy is not another donation
      alert({ kind: "EXTERNAL", donor: "슈퍼챗", fnAmount: 0, amountLabel: "₩100,000" }), // no FN rate yet
      alert({ donor: "퀘스트", fnAmount: 500_000, questId: "q1" }) // held until the quest succeeds
    ];
    expect(topDonation(items, base, NOW)).toEqual({ donor: "익명", amount: "70,000 FN", message: "", at: items[2].createdAt });
    items[6].questSucceeded = true;
    items[6].questSucceededAt = ago(0);
    expect(topDonation(items, base, NOW)).toMatchObject({ donor: "퀘스트", amount: "500,000 FN" });
    expect(topDonation([], base, NOW)).toBeNull();
  });

  it("waits for the alert with 알림이 나올 때 and breaks ties by the chosen rule", () => {
    const items = [alert({ donor: "먼저", fnAmount: 30_000, createdAt: ago(5) }), alert({ donor: "나중", fnAmount: 30_000, createdAt: ago(3) }), alert({ donor: "대기", fnAmount: 80_000, status: "QUEUED" })];
    expect(topDonation(items, base, NOW)?.donor).toBe("대기");
    expect(topDonation(items, { ...base, timing: "PLAYED" }, NOW)?.donor).toBe("나중");
    expect(topDonation(items, { ...base, timing: "PLAYED", tie: "FIRST" }, NOW)?.donor).toBe("먼저");
    // A 최소 금액 filtered alert counts as received but never reached the screen.
    const filtered = [alert({ donor: "숨김", fnAmount: 90_000, status: "FILTERED" })];
    expect(topDonation(filtered, base, NOW)?.donor).toBe("숨김");
    expect(topDonation(filtered, { ...base, timing: "PLAYED" }, NOW)).toBeNull();
  });
});

describe("후원 모니터링", () => {
  it("shows the alert on screen, else the last one shown, and nothing before any", () => {
    const done = alert({ donor: "지난번", message: "고마워요", createdAt: ago(2) });
    const showing = alert({ donor: "지금", fnAmount: 5_000, message: "안녕", status: "SHOWING", createdAt: ago(1) });
    const queued = alert({ donor: "다음", status: "QUEUED" });
    expect(monitorLine([done, showing, queued], { showMessage: true })).toMatchObject({ donor: "지금", amount: "5,000 FN", message: "안녕", playing: true, test: false });
    expect(monitorLine([done, queued], { showMessage: false })).toMatchObject({ donor: "지난번", message: "", playing: false });
    expect(monitorLine([alert({ kind: "TEST", donor: "테스트" })], { showMessage: true })).toMatchObject({ test: true });
    expect(monitorLine([queued], { showMessage: true })).toBeNull();
  });
});

describe("시그 큐 모니터", () => {
  it("lists the signature playing and the next signature alerts queued", () => {
    const sig = (donor: string, status: AlertItem["status"]) => alert({ donor, status, imageUrl: `/mock/sig/${donor}.png`, typeLabel: "시그니처 후원", message: `${donor} 메시지` });
    const items = [sig("끝남", "DONE"), sig("재생", "SHOWING"), alert({ donor: "일반", status: "QUEUED" }), sig("다음1", "QUEUED"), sig("다음2", "QUEUED"), sig("다음3", "QUEUED")];
    expect(sigQueueCards(items, { next: 2, showMessage: true }).map((c) => [c.order, c.donor, c.playing])).toEqual([
      [1, "재생", true],
      [2, "다음1", false],
      [3, "다음2", false]
    ]);
    // A non-signature alert on screen: the queue starts at the next signature.
    items[1].imageUrl = undefined;
    expect(sigQueueCards(items, { next: 1, showMessage: false })).toEqual([{ id: items[3].id, order: 1, playing: false, donor: "다음1", amount: "1,000 FN", message: "", imageUrl: "/mock/sig/다음1.png" }]);
    expect(sigQueueCards(items, { next: 0, showMessage: true })).toEqual([]);
  });
});

describe("알림 모니터 settings and overlays", () => {
  beforeEach(() => resetMockStores());

  it("validates the settings and reads them on the overlays without moving the queue", async () => {
    const { saveWidgetSettings } = await import("./widgetSettings");
    const { getOverlayWidget } = await import("./widgetOverlay");
    const { DEFAULT_WIDGET_SETTINGS } = await import("./widgetSettingsTypes");
    const { mockAlerts } = await import("./alertCore");
    const { mockCreator } = await import("./mockCreatorStore");
    const key = mockCreator.integrationKey;

    const top = DEFAULT_WIDGET_SETTINGS.TOP_DONATION;
    for (const [bad, message] of [
      [{ title: " " }, "제목"],
      [{ prize: "가".repeat(31) }, "상금 문구"],
      [{ period: "분기" }, "기간"],
      [{ timing: "LATER" }, "시점"],
      [{ tie: "RANDOM" }, "같은 금액"],
      [{ showMessage: "yes" }, "설정 값"]
    ] as const) {
      const res = await saveWidgetSettings("TOP_DONATION", { ...top, ...bad });
      expect(res.status === "INVALID" && res.message, message).toContain(message);
    }
    expect(await saveWidgetSettings("TOP_DONATION", { ...top, title: " 오늘의 한 방 ", prize: " 상금 10만원 ", period: "전체" })).toEqual({ status: "SAVED" });
    expect((await saveWidgetSettings("DONATION_MONITOR", { ...DEFAULT_WIDGET_SETTINGS.DONATION_MONITOR, layout: "WIDE" })).status).toBe("INVALID");
    expect(await saveWidgetSettings("DONATION_MONITOR", { ...DEFAULT_WIDGET_SETTINGS.DONATION_MONITOR, layout: "COMPACT" })).toEqual({ status: "SAVED" });
    expect((await saveWidgetSettings("SIG_QUEUE", { ...DEFAULT_WIDGET_SETTINGS.SIG_QUEUE, next: 5 })).status).toBe("INVALID");
    expect(await saveWidgetSettings("SIG_QUEUE", { ...DEFAULT_WIDGET_SETTINGS.SIG_QUEUE, layout: "HORIZONTAL", next: 1 })).toEqual({ status: "SAVED" });

    mockAlerts.items.push(
      { id: "m1", kind: "DONATION", donor: "시그손님", message: "시그 부탁해요", fnAmount: 33_000, typeLabel: "시그니처 후원", imageUrl: "/mock/sig.png", createdAt: new Date().toISOString(), status: "QUEUED" }
    );
    const before = mockAlerts.items.map((a) => a.status);
    const topView = await getOverlayWidget("top-donation", key);
    expect(topView !== "FORBIDDEN" && topView.widget === "top-donation" && topView).toMatchObject({ settings: { title: "오늘의 한 방", prize: "상금 10만원", period: "전체" }, top: { donor: "별빛소나타", amount: "50,000 FN" } });
    const monitor = await getOverlayWidget("donation-monitor", key);
    expect(monitor !== "FORBIDDEN" && monitor.widget === "donation-monitor" && monitor.settings.layout).toBe("COMPACT");
    const queue = await getOverlayWidget("sig-queue", key);
    expect(queue !== "FORBIDDEN" && queue.widget === "sig-queue" && queue.cards.map((c) => c.donor)).toEqual(["시그손님"]);
    expect(mockAlerts.items.map((a) => a.status)).toEqual(before); // reading never plays an alert
    expect(await getOverlayWidget("sig-queue", "wrong-key")).toBe("FORBIDDEN");

    signIn(["SUPPORTER"]);
    expect(await saveWidgetSettings("SIG_QUEUE", DEFAULT_WIDGET_SETTINGS.SIG_QUEUE)).toEqual({ status: "UNAUTHORIZED" });
  });
});
