import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import { ROULETTE_RESULT_SEC } from "./rouletteTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/**
 * 룰렛 (2026-10-04 결정: 당첨은 크리에이터 상품, FN 지급 없음): the creator sets items and percents, the server
 * draws at payment, the wheel reveals the result on the broadcast, and the 리모컨 starts / finishes spins.
 */
async function load() {
  const { mockAccount } = await import("@/services/account/mockStore");
  const { requestDonation } = await import("./donate");
  const core = await import("./rouletteCore");
  const room = await import("./roulette");
  const remote = await import("@/services/creator/rouletteRemote");
  const widgets = await import("@/services/creator/widgetSettings");
  const overlay = await import("@/services/creator/widgetOverlay");
  const { getDonationCatalog } = await import("./signatureCore");
  const { mockCreator } = await import("@/services/creator/mockCreatorStore");
  const { STUDIO_CHANNEL } = await import("@/services/crew/mockCrewStore");
  mockAccount.fnBalance = 100_000;
  return { ...core, ...room, ...remote, ...widgets, ...overlay, requestDonation, getDonationCatalog, account: mockAccount, overlayKey: mockCreator.integrationKey, STUDIO_CHANNEL };
}
type M = Awaited<ReturnType<typeof load>>;

const join = (n: number, amount = 10_000, creatorId = "c1") => ({ creatorId, hideProfile: false, type: "ROULETTE", amount, idempotencyKey: key(n) });

async function saveRoulette(m: M, patch: Record<string, unknown>) {
  const detail = (await m.getWidgetDetail("ROULETTE"))!;
  return m.saveWidgetSettings("ROULETTE", { ...detail.settings, ...patch });
}

const stage = async (m: M) => {
  const o = await m.getOverlayWidget("roulette", m.overlayKey);
  if (o === "FORBIDDEN" || o.widget !== "roulette") throw new Error("roulette overlay");
  return o.stage;
};

describe("룰렛", () => {
  beforeEach(() => resetMockStores());

  it("draws by the integer percents", async () => {
    const m = await load();
    const items = [{ percent: 50 }, { percent: 25 }, { percent: 15 }, { percent: 10 }];
    expect([0, 49, 50, 74, 75, 89, 90, 99].map((r) => m.drawIndex(items, () => r))).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });

  it("saves creator items whose percents add up to 100, and the room shows them", async () => {
    const m = await load();
    const items = [
      { id: "a", name: "꽝", percent: 60 },
      { id: "b", name: "노래 한 곡", percent: 40 }
    ];
    expect(await saveRoulette(m, { items: [{ ...items[0], percent: 70 }, items[1]] })).toMatchObject({ status: "INVALID" });
    expect(await saveRoulette(m, { minAmount: 500 })).toMatchObject({ status: "INVALID" });
    expect(await saveRoulette(m, { items: [items[0]] })).toMatchObject({ status: "INVALID" });
    expect(await saveRoulette(m, { items, minAmount: 5_000, dailyLimit: 2 })).toEqual({ status: "SAVED" });
    expect(m.getDonationCatalog().roulette).toEqual({ enabled: true, minAmount: 5_000, dailyLimit: 2, items: items.map(({ name, percent }) => ({ name, percent })) });
    expect((await m.getWidgetDetail("ROULETTE"))!.overlayPath).toBe(`/overlay/widget/roulette/${m.overlayKey}`);
  });

  it("takes a paid participation, keeps the result hidden while waiting, pays no FN back and enforces the daily limit", async () => {
    const m = await load();
    await saveRoulette(m, { dailyLimit: 2 });
    expect(await m.requestDonation(join(1, 9_999))).toEqual({ status: "INVALID" }); // below 최소 참여 금액

    const first = await m.requestDonation(join(2, 12_000));
    expect(first).toMatchObject({ status: "COMPLETED", fnAmount: 12_000, balance: 88_000 });
    const spin = m.mockRoulette.spins.find((s) => s.channelId === "c1")!;
    expect(spin).toMatchObject({ amount: 12_000, nth: 1, limit: 2, startedAt: null });
    expect(spin.resultIndex).toBeGreaterThanOrEqual(0);

    const view = (await m.getRoomRoulette("c1"))!;
    expect(view).toMatchObject({ waiting: 1, usedToday: 1, participantsToday: 1 });
    expect(view.mine[0]).toMatchObject({ status: "QUEUED", position: 1, result: null, amount: 12_000 });

    expect((await m.requestDonation(join(3))).status).toBe("COMPLETED");
    expect(await m.requestDonation(join(4))).toEqual({ status: "INVALID" }); // 하루 2회 사용
    expect(m.account.fnBalance).toBe(78_000); // only the two debits — no prize credited

    signIn(null);
    expect((await m.getRoomRoulette("c1"))!).toMatchObject({ waiting: 2, usedToday: null, mine: [] });
  });

  it("is closed while 후원 받기 is off", async () => {
    const m = await load();
    await saveRoulette(m, { enabled: false });
    expect(m.getDonationCatalog().roulette.enabled).toBe(false);
    expect(await m.requestDonation(join(1))).toEqual({ status: "INVALID" });
    expect(m.account.fnBalance).toBe(100_000);
  });

  it("spins, reveals the result for a few seconds, then finishes (or 자동 시작 does it)", async () => {
    const m = await load();
    const t0 = Date.parse("2026-10-04T12:00:00");
    const spin = m.enqueueSpin({ id: "s1", channelId: "c9", supporterUserId: "u-1", donor: "룰렛장인", amount: 10_000 }, t0, () => 80); // 80 → 시그니처
    expect(m.statusOf(spin, t0)).toBe("QUEUED"); // 자동 시작 off by default

    m.startSpin(spin, t0);
    const spinning = m.stageOf("c9", t0 + 1_000)!;
    expect(spinning).toMatchObject({ status: "SPINNING", result: null, donor: "룰렛장인", nth: 1, limit: 3 });
    const shown = m.stageOf("c9", t0 + spin.spinMs + 1)!;
    expect(shown).toMatchObject({ status: "RESULT", result: "시그니처" });
    expect(m.roomView("c9", "u-1", t0 + spin.spinMs + 1).mine[0]).toMatchObject({ status: "RESULT", result: "시그니처", position: null });
    expect(m.stageOf("c9", t0 + spin.spinMs + ROULETTE_RESULT_SEC * 1000)).toBeNull();
    expect(m.statusOf(spin, t0 + spin.spinMs + ROULETTE_RESULT_SEC * 1000)).toBe("DONE");

    await saveRoulette(m, { autoStart: true });
    const next = m.enqueueSpin({ id: "s2", channelId: "c9", supporterUserId: "u-2", donor: "오늘도행운", amount: 30_000 }, t0 + 60_000);
    expect(m.statusOf(next, t0 + 60_000)).toBe("SPINNING"); // the wheel was free
    const waiting = m.enqueueSpin({ id: "s3", channelId: "c9", supporterUserId: "u-3", donor: "미션마스터", amount: 20_000 }, t0 + 60_001);
    expect(m.statusOf(waiting, t0 + 60_001)).toBe("QUEUED");
    m.mockRoulette.paused.c9 = true;
    m.advance("c9", t0 + 120_000);
    expect(m.statusOf(waiting, t0 + 120_000)).toBe("QUEUED"); // 일시정지 holds 자동 시작
    m.mockRoulette.paused.c9 = false;
    m.advance("c9", t0 + 120_000);
    expect(m.statusOf(waiting, t0 + 120_000)).toBe("SPINNING");
  });

  it("lets the creator start the next spin and finish a shown result from the 리모컨", async () => {
    const m = await load();
    signIn(["SUPPORTER"]);
    expect(await m.getRouletteRemote()).toBeNull();
    expect(await m.startNextSpin()).toEqual({ status: "UNAUTHORIZED" });
    signIn();

    const view = (await m.getRouletteRemote())!;
    expect(view.queue.map((r) => [r.donor, r.status, r.result])).toEqual([
      ["룰렛장인", "QUEUED", null],
      ["오늘도행운", "QUEUED", null]
    ]);
    expect(view.recent.map((r) => [r.donor, r.result])).toEqual([
      ["행운가득", "꽝"],
      ["미션마스터", "시그니처"]
    ]);
    expect(await stage(m)).toBeNull();

    expect(await m.startNextSpin()).toEqual({ status: "SAVED" });
    expect((await m.startNextSpin()).status).toBe("INVALID"); // one wheel at a time
    const spinning = (await stage(m))!;
    expect(spinning).toMatchObject({ status: "SPINNING", donor: "룰렛장인", result: null });
    expect((await m.finishRouletteSpin({ spinId: spinning.id })).status).toBe("INVALID"); // not revealed yet

    // Let the spin end.
    const spin = m.mockRoulette.spins.find((s) => s.id === spinning.id)!;
    spin.startedAt = new Date(Date.now() - spin.spinMs - 1_000).toISOString();
    const result = (await stage(m))!;
    expect(result.status).toBe("RESULT");
    expect(result.result).toBe(spin.items[spin.resultIndex].name);
    expect(await m.finishRouletteSpin({ spinId: spin.id })).toEqual({ status: "SAVED" });
    expect(await m.finishRouletteSpin({ spinId: spin.id })).toEqual({ status: "SAVED" });
    expect(await stage(m)).toBeNull();
    expect((await m.getRouletteRemote())!.recent[0]).toMatchObject({ donor: "룰렛장인", status: "DONE" });

    expect(await m.setRoulettePaused({ paused: true })).toEqual({ status: "SAVED" });
    expect((await m.getRouletteRemote())!.paused).toBe(true);
    expect((await m.setRoulettePaused({ paused: "yes" })).status).toBe("INVALID");
  });
});
