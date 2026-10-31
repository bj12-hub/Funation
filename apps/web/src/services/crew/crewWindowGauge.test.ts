import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import { DEFAULT_WINDOW_GAUGE, type WindowGaugeSettings } from "./crewTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 시간 내 통합 게이지 (2026-10-25, StreamDonate 참고): the crew's total between 시작 and 정지 against a goal. */
async function load() {
  const bc = await import("./crewBroadcast");
  const feed = await import("./crewFeed");
  const gauge = await import("./crewGauge");
  const prize = await import("./crewPrizeBoard");
  const { attributeMemberDonation } = await import("./crewCore");
  const { mockCrew } = await import("./mockCrewStore");
  const { mockCreator } = await import("@/services/creator/mockCreatorStore");
  // The seed's 멤버 지정 후원 are stamped around now; these tests count only their own.
  mockCrew.attributions = [];
  return { ...bc, ...feed, ...gauge, ...prize, attributeMemberDonation, overlayKey: mockCreator.integrationKey };
}

const settings = (patch: Partial<WindowGaugeSettings> = {}) => ({ ...DEFAULT_WINDOW_GAUGE, ...patch });
const at = (s: string) => vi.setSystemTime(new Date(`2026-10-25T12:${s}Z`));

describe("시간 내 통합 게이지", () => {
  beforeEach(() => resetMockStores());
  afterEach(() => vi.useRealTimers());

  it("counts every donation of the 구간 on 후원금 and the members' 구간 points on 기여도", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-25T12:00:00Z"), toFake: ["Date"] });
    const m = await load();
    await m.setMemberKeywords({ memberId: "cm-s1", keywords: ["길동"] });
    await m.setExcelSettings({ unit: "FN", rates: {}, rules: [{ min: 10_000, multiplier: 2 }] });
    await m.saveWindowGauge(settings({ goal: 20_000 }));
    await m.startBroadcast({ requestId: crypto.randomUUID(), title: "구간 게이지", teamMode: false });
    const id = (await m.getBroadcastView())!.live!.id;
    let n = 0;
    const sim = (amount: number, message = "", unit = "FN") => m.simulateDonation({ broadcastId: id, requestId: key(++n), amount, unit, message });
    const gauge = async () => (await m.getBroadcastView())!.live!.windowGauge;

    await sim(9_000, "길동"); // before 시작
    expect(await gauge()).toMatchObject({ window: null, current: 0, target: 20_000, percent: 0, unit: "FN", count: 0 });

    at("01:00");
    expect(await m.startPrizeWindow({ broadcastId: id, board: "WINDOW_GAUGE", requestId: key(100) })).toEqual({ status: "SAVED" });
    at("02:00");
    await sim(10_000, "길동"); // assigned: 10,000 FN, ×2 → 20,000점
    await sim(3_000); // 미지정: counts on 후원금 only
    await sim(500, "", "SOOP_BALLOON"); // no 환산값 on the FN basis: adds nothing
    const cancelled = (await m.getBroadcastView())!.feed!.entries.find((e) => e.amount === 3_000)!;
    await sim(4_000);
    await m.cancelFeedEntry({ broadcastId: id, entryId: (await m.getBroadcastView())!.feed!.entries[0].id }); // the 4,000: cancelled
    m.attributeMemberDonation("dn-1", "studio", "cm-s2", 2_000); // 멤버 지정 후원
    await m.startPrizeWindow({ broadcastId: id, board: "WINDOW_GAUGE", requestId: key(100) }); // retried start: no restart
    expect(cancelled.status).toBe("UNMATCHED");
    expect(await gauge()).toMatchObject({ current: 15_000, target: 20_000, percent: 75, count: 4 });

    await m.saveWindowGauge(settings({ basis: "POINTS", goal: 20_000 }));
    expect(await gauge()).toMatchObject({ current: 22_000, percent: 100, unit: "점" }); // 20,000 + 2,000

    // 자동 증량: past the goal, the target moves up by the step.
    await m.saveWindowGauge(settings({ basis: "POINTS", goal: 20_000, autoRaise: 5_000 }));
    expect(await gauge()).toMatchObject({ current: 22_000, target: 25_000, percent: 88 });

    at("03:00");
    await m.stopPrizeWindow({ broadcastId: id, board: "WINDOW_GAUGE" });
    at("04:00");
    await sim(50_000, "길동"); // after 정지
    expect(await gauge()).toMatchObject({ current: 22_000, window: { startedAt: "2026-10-25T12:01:00.000Z", stoppedAt: "2026-10-25T12:03:00.000Z" } });

    // The 상품 순위표 keeps its own 구간 (and the board key is checked).
    expect((await m.getBroadcastView())!.live!.prizeBoard.window).toBeNull();
    expect((await m.startPrizeWindow({ broadcastId: id, board: "BOTH", requestId: key(101) })).status).toBe("INVALID");

    // 다시 시작 counts from now; 방송 종료 closes a running 구간.
    at("05:00");
    await m.startPrizeWindow({ broadcastId: id, board: "WINDOW_GAUGE", requestId: key(102) });
    expect(await gauge()).toMatchObject({ current: 0, count: 0 });
    at("06:00");
    await m.endBroadcast(id);
    const ended = (await import("./mockCrewStore")).mockCrew.broadcasts!.find((b) => b.id === id)!;
    expect(ended.windowGauge!.window!.stoppedAt).toBe("2026-10-25T12:06:00.000Z");
  });

  it("is shown on OBS after OBS에 표시, and validates its settings", async () => {
    const m = await load();
    await m.startBroadcast({ requestId: crypto.randomUUID(), title: "구간 게이지", teamMode: false });
    const id = (await m.getBroadcastView())!.live!.id;
    expect(await m.setPrizeBoardVisible({ broadcastId: id, board: "WINDOW_GAUGE", on: true })).toEqual({ status: "SAVED" });
    const overlay = await m.getOverlayScoreboard(m.overlayKey);
    expect(overlay !== "IDLE" && overlay !== "FORBIDDEN" && [overlay.windowGauge.visible, overlay.prizeBoard.visible]).toEqual([true, false]);

    const ok = settings({ title: " 오늘 목표 ", basis: "POINTS", goal: 500_000, autoRaise: 100_000, numbers: "PERCENT", placement: "RIGHT" });
    expect(await m.saveWindowGauge(ok)).toEqual({ status: "SAVED" });
    expect((await m.getBroadcastView())!.windowGaugeSettings).toEqual({ ...ok, title: "오늘 목표" });
    for (const [patch, message] of [
      [{ title: "가".repeat(21) }, "제목"],
      [{ title: "admin 목표" }, "사용할 수 없는"],
      [{ basis: "COUNT" }, "집계 기준"],
      [{ goal: 0 }, "목표"],
      [{ goal: 1.5 }, "목표"],
      [{ autoRaise: -1 }, "자동 증량"],
      [{ numbers: "BAR" }, "숫자 표시"],
      [{ placement: "TOP" }, "배치"]
    ] as const) {
      const res = await m.saveWindowGauge({ ...ok, ...patch });
      expect(res.status === "INVALID" && res.message, message).toContain(message);
    }
    signIn(["SUPPORTER"]);
    expect(await m.saveWindowGauge(ok)).toEqual({ status: "UNAUTHORIZED" });
  });
});
