import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, rejoinWithPhone, resetMockStores, signIn } from "@/test/mockEnv";
import { fillGachaMessage } from "./gachaTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/**
 * 뽑기 후원 (2026-10-04 결정: 당첨은 크리에이터 상품, FN 지급 없음): viewers draw from the creator's 뽑기
 * widget, the server draws at payment (상품소진형 stock goes down), draws play in order on the 뽑기 overlay,
 * and the 리모컨 marks prizes as handed over.
 */
async function load() {
  const { mockAccount } = await import("@/services/account/mockStore");
  const { requestDonation } = await import("./donate");
  const core = await import("./gachaCore");
  const room = await import("./gacha");
  const remote = await import("@/services/creator/gachaRemote");
  const widgets = await import("@/services/creator/widgetSettings");
  const overlay = await import("@/services/creator/widgetOverlay");
  const { getDonationCatalog } = await import("./signatureCore");
  const { getDonationHistory } = await import("@/services/wallet/walletHistory");
  const { widgetStore } = await import("@/services/creator/widgetStore");
  const { mockCreator } = await import("@/services/creator/mockCreatorStore");
  const { STUDIO_CHANNEL } = await import("@/services/crew/mockCrewStore");
  mockAccount.fnBalance = 100_000;
  return { ...core, ...room, ...remote, ...widgets, ...overlay, requestDonation, getDonationCatalog, getDonationHistory, widgetStore, account: mockAccount, overlayKey: mockCreator.integrationKey, STUDIO_CHANNEL };
}
type M = Awaited<ReturnType<typeof load>>;

/** `expectedAmount`: the price the supporter confirmed (gacha-1 3,000 · gacha-2 5,000 in setGachas). */
const draw = (n: number, gachaId = "gacha-1", termsAgreed = true, expectedAmount = gachaId === "gacha-2" ? 5_000 : 3_000) => ({
  creatorId: "c1",
  hideProfile: false,
  type: "GACHA",
  gachaId,
  termsAgreed,
  expectedAmount,
  idempotencyKey: key(n)
});
/** Member `n` for the core calls: member id, account marker (null = the first account) and person key. */
const member = (n: number) => ({ supporterUserId: `u-${n}`, account: null, person: `person-${n}` });

/** Two 뽑기: 당첨확률형 (상품 30% · 꽝 70%) and 상품소진형 (2 + 1). */
function setGachas(m: M, patch: Partial<M["widgetStore"]["GACHA"]["gachas"][number]> = {}) {
  const base = m.widgetStore.GACHA.gachas[0];
  m.widgetStore.GACHA.gachas = [
    { ...base, prizes: [{ id: "p1", name: "문화상품권 5천원", kind: "PRIZE", value: 30 }, { id: "p2", name: "꽝 (다음 기회에)", kind: "BLANK", value: 70 }], ...patch },
    { ...base, id: "gacha-2", name: "굿즈 뽑기", price: 5_000, prizeMode: "STOCK", prizes: [{ id: "s1", name: "아크릴 스탠드", kind: "PRIZE", value: 2 }, { id: "s2", name: "엽서", kind: "PRIZE", value: 1 }] }
  ];
}

describe("뽑기 후원", () => {
  beforeEach(() => resetMockStores());

  it("picks by weight and fills the message template", async () => {
    const m = await load();
    expect([0, 49, 50, 79, 80, 99].map((r) => m.weightedIndex([50, 30, 20], () => r))).toEqual([0, 0, 1, 1, 2, 2]);
    expect(fillGachaMessage("{닉네임}님이 {금액} 뽑기 후원을 하였습니다!", "보라색원픽", 3_000)).toBe("보라색원픽님이 3,000FN 뽑기 후원을 하였습니다!");
  });

  it("offers the enabled 뽑기 with odds or stock in the room", async () => {
    const m = await load();
    setGachas(m);
    m.widgetStore.GACHA.gachas.push({ ...m.widgetStore.GACHA.gachas[0], id: "gacha-off", name: "꺼진 뽑기", enabled: false });
    const offers = m.getDonationCatalog().gacha;
    expect(offers.map((o) => [o.name, o.price, o.mode, o.soldOut])).toEqual([
      ["뽑기 후원", 3_000, "PROBABILITY", false],
      ["굿즈 뽑기", 5_000, "STOCK", false]
    ]);
    expect(offers[0].prizes).toEqual([
      { name: "문화상품권 5천원", blank: false, percent: 30, left: null },
      { name: "꽝 (다음 기회에)", blank: true, percent: 70, left: null }
    ]);
    expect(offers[1].prizes.map((p) => p.left)).toEqual([2, 1]);
  });

  it("charges the 뽑기 price, draws at payment, hides the prize until it plays and pays no FN back", async () => {
    const m = await load();
    setGachas(m);
    expect(await m.requestDonation(draw(1, "gacha-1", false))).toEqual({ status: "INVALID" }); // 확률 안내 동의 필수
    expect(await m.requestDonation({ ...draw(2), gachaId: "nope" })).toEqual({ status: "INVALID" });

    const done = await m.requestDonation(draw(3));
    expect(done).toMatchObject({ status: "COMPLETED", fnAmount: 3_000, balance: 97_000 });
    const record = m.mockGacha.draws.find((d) => d.channelId === "c1")!;
    expect(["문화상품권 5천원", "꽝 (다음 기회에)"]).toContain(record.prize);
    expect(record.startedAt).not.toBeNull(); // the machine was free, so it plays right away

    const view = (await m.getRoomGacha("c1"))!;
    expect(view.mine[0]).toMatchObject({ gachaName: "뽑기 후원", status: "SPINNING", prize: null, blank: null });
    expect(view.usedToday).toEqual({ "gacha-1": 1 });

    const t = Date.parse(record.startedAt!) + record.spinMs + 1;
    expect(m.roomView("c1", { userId: record.supporterUserId, account: record.account, person: record.person }, t).mine[0]).toMatchObject({ status: "RESULT", prize: record.prize, blank: record.blank });

    // 후원 내역 › 게임 후원: the draw state, then the prize once the machine stopped.
    const range = { preset: "range" as const, from: "2000-01-01", to: "2099-12-31" };
    const row = async () => (await m.getDonationHistory({ period: range, category: "game" }))!.items.find((d) => d.id === record.id)!;
    expect((await row()).gameResult).toBe("뽑는 중");
    record.startedAt = new Date(Date.now() - record.spinMs - 500).toISOString();
    expect((await row()).gameResult).toBe(record.blank ? "뽑기 결과 · 꽝" : `뽑기 결과 · ${record.prize} 당첨`);
    expect(m.account.fnBalance).toBe(97_000);
  });

  it("uses up 상품소진형 stock and the 1인 횟수 한도", async () => {
    const m = await load();
    setGachas(m, { limitEnabled: true, limitCount: 1 });
    expect((await m.requestDonation(draw(1))).status).toBe("COMPLETED");
    expect(await m.requestDonation(draw(2))).toEqual({ status: "INVALID" }); // 하루 1회

    for (let i = 3; i <= 5; i++) expect((await m.requestDonation(draw(i, "gacha-2"))).status).toBe("COMPLETED");
    expect(m.widgetStore.GACHA.gachas[1].prizes.map((p) => p.value)).toEqual([0, 0]);
    const won = m.mockGacha.draws.filter((d) => d.gachaId === "gacha-2").map((d) => d.prize).sort();
    expect(won).toEqual(["아크릴 스탠드", "아크릴 스탠드", "엽서"]);
    expect(m.getDonationCatalog().gacha[1].soldOut).toBe(true);
    expect(await m.requestDonation(draw(6, "gacha-2"))).toEqual({ status: "INVALID" });
    expect(m.account.fnBalance).toBe(100_000 - 3_000 - 3 * 5_000);
  });

  it("shows 상품소진형 stock going down only when a draw is revealed", async () => {
    const m = await load();
    setGachas(m);
    const t0 = Date.parse("2026-10-04T12:00:00");
    const enqueue = (id: string, at: number) => m.enqueueDraw({ id, channelId: "c1", ...member(1), donor: "보라색원픽", shownDonor: "보라색원픽", gachaId: "gacha-2", amount: 5_000 }, at, () => 0);
    const first = enqueue("d1", t0); // 아크릴 스탠드
    const second = enqueue("d2", t0 + 1); // 아크릴 스탠드 (queued behind the first)
    const left = (at: number) => m.gachaOffers(at)[1].prizes.map((p) => p.left);
    expect(m.widgetStore.GACHA.gachas[1].prizes.map((p) => p.value)).toEqual([0, 1]); // taken at payment
    expect(left(t0 + 1)).toEqual([2, 1]); // a reload while spinning tells nothing
    // A prize at 0 is never drawn, whatever the room shows.
    expect(enqueue("d3", t0 + 2).prize).toBe("엽서");
    expect(m.gachaOffers(t0 + 2)[1].soldOut).toBe(true);
    expect(left(t0 + first.spinMs)).toEqual([1, 1]); // the first is revealed
    const secondShown = t0 + first.spinMs + first.showMs + second.spinMs;
    m.advance("c1", t0 + first.spinMs + first.showMs);
    expect(left(secondShown)).toEqual([0, 1]);
  });

  it("charges the price the supporter confirmed, or nothing when the creator changed it (PRICE_CHANGED)", async () => {
    const m = await load();
    setGachas(m);
    expect(await m.requestDonation({ ...draw(1), expectedAmount: undefined })).toEqual({ status: "INVALID" }); // a price must be confirmed
    m.widgetStore.GACHA.gachas[0].price = 4_000; // changed after the panel loaded at 3,000
    expect(await m.requestDonation(draw(2))).toEqual({ status: "PRICE_CHANGED", amount: 4_000 });
    expect(await m.requestDonation(draw(2))).toEqual({ status: "PRICE_CHANGED", amount: 4_000 }); // retry: same answer
    expect(m.account.fnBalance).toBe(100_000);
    expect(m.mockGacha.draws.some((d) => d.channelId === "c1")).toBe(false);

    const done = await m.requestDonation(draw(3, "gacha-1", true, 4_000));
    expect(done).toMatchObject({ status: "COMPLETED", fnAmount: 4_000, balance: 96_000 });
    // A retry of the completed request still gets its answer after the price moves again.
    m.widgetStore.GACHA.gachas[0].price = 2_000;
    expect(await m.requestDonation(draw(3, "gacha-1", true, 4_000))).toEqual(done);
    expect(m.account.fnBalance).toBe(96_000);
  });

  it("records the debited amount on the draw, not a price read later", async () => {
    const m = await load();
    setGachas(m);
    const d = m.enqueueDraw({ id: "d1", channelId: "c1", ...member(1), donor: "보라색원픽", shownDonor: "보라색원픽", gachaId: "gacha-1", amount: 2_500 }, Date.now(), () => 0);
    expect(d).toMatchObject({ amount: 2_500, message: "보라색원픽님이 2,500FN 뽑기 후원을 하였습니다!" });
  });

  it("never brings back 상품소진형 stock drawn while the settings form was open", async () => {
    const m = await load();
    setGachas(m);
    const loaded = (await m.getWidgetDetail("GACHA"))!.settings as M["widgetStore"]["GACHA"];
    for (let i = 1; i <= 3; i++) expect((await m.requestDonation(draw(i, "gacha-2"))).status).toBe("COMPLETED");
    expect(m.getDonationCatalog().gacha[1].soldOut).toBe(true);

    // The creator renames the 뽑기 in the form loaded at 2 + 1 and saves: the stock stays used up.
    const renamed = { ...loaded, gachas: loaded.gachas.map((g) => (g.id === "gacha-2" ? { ...g, name: "굿즈 뽑기 시즌2" } : g)) };
    expect(await m.saveWidgetSettings("GACHA", renamed)).toEqual({ status: "SAVED" });
    expect(m.widgetStore.GACHA.gachas[1]).toMatchObject({ name: "굿즈 뽑기 시즌2", prizes: [{ value: 0, drawn: 2 }, { value: 0, drawn: 1 }] });
    expect(await m.requestDonation(draw(4, "gacha-2"))).toEqual({ status: "INVALID" }); // still sold out

    // Restocking from a fresh form: the entered count is kept; a draw made after loading still comes off it.
    const fresh = (await m.getWidgetDetail("GACHA"))!.settings as M["widgetStore"]["GACHA"];
    const restocked = { ...fresh, gachas: fresh.gachas.map((g) => (g.id === "gacha-2" ? { ...g, prizes: g.prizes.map((p) => ({ ...p, value: 5 })) } : g)) };
    expect(await m.saveWidgetSettings("GACHA", restocked)).toEqual({ status: "SAVED" });
    expect(m.widgetStore.GACHA.gachas[1].prizes.map((p) => p.value)).toEqual([5, 5]);
    await m.requestDonation(draw(5, "gacha-2"));
    expect(await m.saveWidgetSettings("GACHA", restocked)).toEqual({ status: "SAVED" }); // the same form again
    expect(m.widgetStore.GACHA.gachas[1].prizes.reduce((s, p) => s + p.value, 0)).toBe(9);
    // `drawn` stays the server's count whatever the form sends.
    const forged = { ...fresh, gachas: fresh.gachas.map((g) => (g.id === "gacha-2" ? { ...g, prizes: g.prizes.map((p) => ({ ...p, value: 1, drawn: 999 })) } : g)) };
    await m.saveWidgetSettings("GACHA", forged);
    expect(m.widgetStore.GACHA.gachas[1].prizes.reduce((s, p) => s + (p.drawn ?? 0), 0)).toBe(4);
  });

  it("plays draws one at a time, then lists prizes on the board and the 당첨 내역", async () => {
    const m = await load();
    setGachas(m);
    const t0 = Date.parse("2026-10-04T12:00:00");
    const first = m.enqueueDraw({ id: "d1", channelId: m.STUDIO_CHANNEL, ...member(1), donor: "오늘은된다", shownDonor: "오늘은된다", gachaId: "gacha-1", amount: 3_000 }, t0, () => 0); // 상품
    const second = m.enqueueDraw({ id: "d2", channelId: m.STUDIO_CHANNEL, ...member(2), donor: "확률의신", shownDonor: "확률의신", gachaId: "gacha-1", amount: 3_000 }, t0 + 1, () => 99); // 꽝
    expect(m.statusOf(first, t0)).toBe("SPINNING");
    expect(m.statusOf(second, t0 + 1)).toBe("QUEUED");
    expect(m.stageOf(m.STUDIO_CHANNEL, t0 + 1_000)).toMatchObject({ status: "SPINNING", prize: null, donor: "오늘은된다", message: "오늘은된다님이 3,000FN 뽑기 후원을 하였습니다!" });
    expect(m.stageOf(m.STUDIO_CHANNEL, t0 + first.spinMs + 1)).toMatchObject({ status: "RESULT", prize: "문화상품권 5천원", blank: false });
    const next = t0 + first.spinMs + first.showMs;
    expect(m.stageOf(m.STUDIO_CHANNEL, next)).toMatchObject({ donor: "확률의신", status: "SPINNING" });

    const board = m.boardOf(m.STUDIO_CHANNEL, next);
    expect(board.rows.map((r) => [r.donor, r.prize, r.claimed])).toContainEqual(["오늘은된다", "문화상품권 5천원", false]);
    expect(board.rows.every((r) => r.prize !== "꽝 (다음 기회에)")).toBe(true);
  });

  it("lists past prizes on the overlay's credit list under the name shown on stream, not the name sent", async () => {
    const m = await load();
    setGachas(m);
    // 대체 메시지 replaced the sender's name when the draw was paid (shownOnStream in the Donation Core).
    const d = m.enqueueDraw({ id: "d-credit", channelId: m.STUDIO_CHANNEL, ...member(3), donor: "클리어왕", shownDonor: "익명", gachaId: "gacha-1", amount: 3_000 }, Date.now(), () => 0); // 상품
    d.startedAt = new Date(Date.now() - d.spinMs - d.showMs - 1_000).toISOString(); // played and done
    const o = await m.getOverlayWidget("gacha", m.overlayKey);
    if (o === "FORBIDDEN" || o.widget !== "gacha") throw new Error("no gacha overlay");
    expect(o.history[0]).toEqual({ donor: "익명", prize: "문화상품권 5천원" });
    expect(JSON.stringify(o)).not.toContain("클리어왕");
    // The 리모컨 (the creator's own view) keeps the name as sent.
    expect((await m.getGachaRemote())!.recent[0]).toMatchObject({ donor: "클리어왕" });
  });

  it("lets the creator finish a shown result and mark prizes as handed over", async () => {
    const m = await load();
    signIn(["SUPPORTER"]);
    expect(await m.getGachaRemote()).toBeNull();
    expect(await m.setGachaClaimed({ drawId: "dr-seed-1042", claimed: true })).toEqual({ status: "UNAUTHORIZED" });
    signIn();

    const view = (await m.getGachaRemote())!;
    expect(view.recent.map((r) => [r.donor, r.prize, r.claimed])).toEqual([
      ["보라색원픽", "문화상품권 5천원", false],
      ["오늘은된다", "꽝 (다음 기회에)", null]
    ]);
    expect(view.unclaimed).toBe(1);
    expect((await m.setGachaClaimed({ drawId: "dr-seed-1041", claimed: true })).status).toBe("INVALID"); // 꽝
    expect(await m.setGachaClaimed({ drawId: "dr-seed-1042", claimed: true })).toEqual({ status: "SAVED" });
    expect((await m.getGachaRemote())!.unclaimed).toBe(0);
    const detail = (await m.getWidgetDetail("GACHA"))!;
    expect(detail.live.gachaWins[0]).toEqual({ gacha: "뽑기 후원", prize: "문화상품권 5천원", claimed: true });
    expect(detail.live.gachaBoardUrl).toBe(`/overlay/widget/gacha-board/${m.overlayKey}`);
    expect(detail.overlayPath).toBe(`/overlay/widget/gacha/${m.overlayKey}`);

    setGachas(m);
    const d = m.enqueueDraw({ id: "d9", channelId: m.STUDIO_CHANNEL, ...member(9), donor: "보라색원픽", shownDonor: "보라색원픽", gachaId: "gacha-1", amount: 3_000 }, Date.now(), () => 0);
    expect((await m.finishGachaDraw({ drawId: d.id })).status).toBe("INVALID"); // still drawing
    d.startedAt = new Date(Date.now() - d.spinMs - 500).toISOString();
    const o = await m.getOverlayWidget("gacha", m.overlayKey);
    expect(o !== "FORBIDDEN" && o.widget === "gacha" && o.stage).toMatchObject({ status: "RESULT", prize: "문화상품권 5천원" });
    expect(await m.setGachaHidden({ hidden: true })).toEqual({ status: "SAVED" });
    const hidden = await m.getOverlayWidget("gacha", m.overlayKey);
    expect(hidden !== "FORBIDDEN" && hidden.widget === "gacha" && hidden.stage).toBeNull();
    expect((await m.getGachaRemote())!).toMatchObject({ hidden: true, stage: { status: "RESULT" } });
    await m.setGachaHidden({ hidden: false });
    expect(await m.finishGachaDraw({ drawId: d.id })).toEqual({ status: "SAVED" });
    const after = await m.getOverlayWidget("gacha", m.overlayKey);
    expect(after !== "FORBIDDEN" && after.widget === "gacha" && after.stage).toBeNull();
    const board = await m.getOverlayWidget("gacha-board", m.overlayKey);
    expect(board !== "FORBIDDEN" && board.widget === "gacha-board" && board.board.title).toBe("뽑기 당첨 리스트");
  });
});

describe("뽑기 · 재가입 (2026-10-08 결정)", () => {
  beforeEach(() => {
    resetMockStores();
    vi.useFakeTimers({ toFake: ["Date"] });
  });
  afterEach(() => vi.useRealTimers());

  it("keeps 내 뽑기 with the account and counts the 1인 횟수 한도 per person and KST day", async () => {
    vi.setSystemTime(new Date("2026-10-08T23:40:00+09:00"));
    const m = await load();
    setGachas(m, { limitEnabled: true, limitCount: 1 });
    const room = async () => (await m.getRoomGacha("c1"))!;
    expect((await m.requestDonation(draw(1))).status).toBe("COMPLETED");
    expect(await m.requestDonation(draw(2))).toEqual({ status: "INVALID" }); // 하루 1회
    expect(await room()).toMatchObject({ usedToday: { "gacha-1": 1 } });
    expect((await room()).mine).toHaveLength(1);

    // The same person (same verified phone) signs up again that day: no old 내 뽑기, and that day's limit stays used.
    vi.setSystemTime(new Date("2026-10-08T23:45:00+09:00"));
    await rejoinWithPhone("010-1234-5678");
    m.account.fnBalance = 100_000;
    expect(await room()).toMatchObject({ usedToday: { "gacha-1": 1 }, mine: [] });
    expect(await m.requestDonation(draw(3))).toEqual({ status: "INVALID" });

    // Someone else signs up in the slot: their own limit, their own list.
    vi.setSystemTime(new Date("2026-10-08T23:50:00+09:00"));
    await rejoinWithPhone("010-0000-0000");
    m.account.fnBalance = 100_000;
    expect(await room()).toMatchObject({ usedToday: {}, mine: [] });
    expect((await m.requestDonation(draw(4))).status).toBe("COMPLETED");
    expect((await room()).mine).toHaveLength(1);
    // The creator's side keeps every draw, whichever account sent it.
    vi.setSystemTime(new Date("2026-10-08T23:51:00+09:00"));
    expect(m.channelRows("c1").recent).toHaveLength(2);
    // The person key (verified phone) never leaves the server.
    expect(JSON.stringify([await room(), m.channelRows("c1"), m.boardOf("c1")])).not.toMatch(/010-/);

    // The day turns at 00:00 KST (it is still 2026-10-08 in UTC).
    vi.setSystemTime(new Date("2026-10-09T00:05:00+09:00"));
    expect(await room()).toMatchObject({ usedToday: {} });
    expect((await m.requestDonation(draw(5))).status).toBe("COMPLETED");
  });
});
