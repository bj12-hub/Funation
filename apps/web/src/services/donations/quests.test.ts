import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/**
 * 퀘스트 후원 결과: the supporter can always decide, the creator too with 크리에이터 성공 결정; a failed
 * quest refunds the whole amount (2026-10-04 결정) exactly once, and a result never changes.
 */
async function load() {
  const { mockAccount } = await import("@/services/account/mockStore");
  const { requestDonation } = await import("./donate");
  const quests = await import("./quests");
  const core = await import("./questCore");
  const management = await import("@/services/creator/donationManagement");
  const wallet = await import("@/services/wallet/walletHistory");
  const { mockWallet } = await import("@/services/wallet/mockWalletStore");
  const creators = await import("@/services/creators/creators");
  mockAccount.fnBalance = 100_000;
  return { ...quests, ...core, ...management, ...wallet, requestDonation, account: mockAccount, walletStore: mockWallet, creators };
}

const quest = (n: number, creatorId: string, creatorDecides: boolean, extra: Record<string, unknown> = {}) => ({
  creatorId,
  hideProfile: false,
  type: "QUEST",
  title: `퀘스트 ${n}`,
  successReward: 10_000,
  timeLimitSec: 600,
  creatorDecides,
  termsAgreed: true,
  idempotencyKey: key(n),
  ...extra
});

const range = { preset: "range" as const, from: "2000-01-01", to: "2099-12-31" };

describe("퀘스트 후원 결과", () => {
  beforeEach(() => resetMockStores());

  it("refunds the whole amount once when the supporter decides FAILED, and never changes a result", async () => {
    const m = await load();
    const sent = await m.requestDonation(quest(1, "c1", false));
    if (sent.status !== "COMPLETED") throw new Error(sent.status);
    expect(m.account.fnBalance).toBe(90_000);
    const row = (await m.getDonationHistory({ period: range, category: "quest" }))!.items.find((d) => d.id === sent.donationId)!;
    expect(row.quest).toEqual({ status: "IN_PROGRESS", canDecide: true });

    expect(await m.decideMyQuest({ id: sent.donationId, outcome: "MAYBE" })).toEqual({ status: "INVALID" });
    expect(await m.decideMyQuest({ id: sent.donationId, outcome: "FAILED" })).toEqual({ status: "OK", questStatus: "FAILED", refundedFn: 10_000 });
    expect(m.account.fnBalance).toBe(100_000);
    // Retrying the same decision refunds nothing more; the other outcome is refused.
    expect(await m.decideMyQuest({ id: sent.donationId, outcome: "FAILED" })).toEqual({ status: "OK", questStatus: "FAILED", refundedFn: 10_000 });
    expect(await m.decideMyQuest({ id: sent.donationId, outcome: "SUCCESS" })).toEqual({ status: "ALREADY_DECIDED", questStatus: "FAILED" });
    expect(m.account.fnBalance).toBe(100_000);

    const record = m.walletStore.donations.find((d) => d.id === sent.donationId)!;
    expect(record.status).toBe("REFUNDED");
    expect(record.refundedAt).toBeTruthy();
    const ledger = (await m.getWalletOverview({ period: "all" }))!;
    expect(ledger.entries.filter((e) => e.id === `${sent.donationId}-refund`)).toEqual([expect.objectContaining({ kind: "REFUND", deltaFn: 10_000 })]);
    const after = (await m.getDonationHistory({ period: range, category: "quest" }))!.items.find((d) => d.id === sent.donationId)!;
    expect(after.quest).toEqual({ status: "FAILED", canDecide: false });
  });

  it("keeps the FN with the creator on SUCCESS, and only the sender can decide their quest", async () => {
    const m = await load();
    const sent = await m.requestDonation(quest(1, "c1", true));
    if (sent.status !== "COMPLETED") throw new Error(sent.status);
    expect(await m.decideMyQuest({ id: sent.donationId, outcome: "SUCCESS" })).toEqual({ status: "OK", questStatus: "SUCCESS", refundedFn: 0 });
    expect(m.account.fnBalance).toBe(90_000);
    expect(m.walletStore.donations.find((d) => d.id === sent.donationId)!.status).toBe("COMPLETED");
    expect(await m.decideMyQuest({ id: "q1", outcome: "FAILED" })).toEqual({ status: "NOT_FOUND" }); // someone else's quest
    expect(await m.decideMyQuest({ id: "nope", outcome: "FAILED" })).toEqual({ status: "NOT_FOUND" });
    signIn(null);
    expect(await m.decideMyQuest({ id: sent.donationId, outcome: "FAILED" })).toEqual({ status: "UNAUTHORIZED" });
  });

  it("has no 실패 · 취소 금액 (a failure or a cancel refunds everything)", async () => {
    const m = await load();
    const sent = await m.requestDonation(quest(2, "c1", true, { failAmount: 5_000, cancelAmount: 20_000 }));
    expect(sent.status).toBe("COMPLETED");
    expect(m.mockQuests.items[0]).toMatchObject({ title: "퀘스트 2", amount: 10_000, status: "IN_PROGRESS", creatorDecides: true });
  });
});

describe("크리에이터의 퀘스트 결정", () => {
  beforeEach(() => resetMockStores());

  it("decides quests sent to the studio when 크리에이터 성공 결정 is on, and refunds on FAILED", async () => {
    const m = await load();
    const list = async () => (await m.getReceivedDonations({ kind: "quest", period: range, status: "ALL", query: "", page: 1 }))!.items;
    const running = (await list()).filter((d) => d.questActions?.length);
    expect(running.map((d) => [d.status, d.questActions])).toEqual([
      ["IN_PROGRESS", ["SUCCESS", "FAILED", "CANCELED"]],
      ["IN_PROGRESS", ["SUCCESS", "FAILED", "CANCELED"]]
    ]);
    const target = running[0];
    expect(await m.decideReceivedQuest({ id: target.id, outcome: "FAILED" })).toEqual({ status: "OK", questStatus: "FAILED", refundedFn: target.amount });
    expect(await m.decideReceivedQuest({ id: target.id, outcome: "SUCCESS" })).toEqual({ status: "ALREADY_DECIDED", questStatus: "FAILED" });
    expect((await list()).find((d) => d.id === target.id)).toMatchObject({ status: "FAILED", questActions: [] });
    expect(await m.decideReceivedQuest({ id: "nope", outcome: "SUCCESS" })).toEqual({ status: "NOT_FOUND" });
    signIn(["SUPPORTER"]);
    expect(await m.decideReceivedQuest({ id: running[1].id, outcome: "SUCCESS" })).toEqual({ status: "UNAUTHORIZED" });
  });

  it("leaves a quest without 크리에이터 성공 결정 to its sender, whose refund reaches their wallet", async () => {
    const m = await load();
    // Only the studio channel has a 받은 후원 list in mock mode.
    const c1 = (await m.creators.getCreatorById("c1"))!;
    vi.spyOn(m.creators, "getCreatorById").mockResolvedValue({ ...c1, id: "studio" });
    const sent = await m.requestDonation(quest(1, "studio", false));
    if (sent.status !== "COMPLETED") throw new Error(sent.status);
    expect(await m.decideReceivedQuest({ id: sent.donationId, outcome: "FAILED" })).toEqual({ status: "FORBIDDEN" });
    expect(await m.decideMyQuest({ id: sent.donationId, outcome: "FAILED" })).toMatchObject({ status: "OK", refundedFn: 10_000 });
    expect(m.account.fnBalance).toBe(100_000);
    const row = (await m.getReceivedDonations({ kind: "quest", period: range, status: "FAILED", query: "", page: 1 }))!.items.find((d) => d.id === sent.donationId);
    expect(row).toMatchObject({ status: "FAILED", questActions: [] });
  });

  it("lets the creator cancel any running quest with a full refund (2026-10-04 결정), once", async () => {
    const m = await load();
    const c1 = (await m.creators.getCreatorById("c1"))!;
    vi.spyOn(m.creators, "getCreatorById").mockResolvedValue({ ...c1, id: "studio" });
    const sent = await m.requestDonation(quest(1, "studio", false));
    if (sent.status !== "COMPLETED") throw new Error(sent.status);
    const before = (await m.getReceivedDonations({ kind: "quest", period: range, status: "ALL", query: "", page: 1 }))!.items.find((d) => d.id === sent.donationId)!;
    expect(before.questActions).toEqual(["CANCELED"]); // the supporter decides 성공 · 실패
    expect(await m.decideMyQuest({ id: sent.donationId, outcome: "CANCELED" })).toEqual({ status: "INVALID" }); // only the creator cancels
    expect(await m.decideReceivedQuest({ id: sent.donationId, outcome: "CANCELED" })).toEqual({ status: "OK", questStatus: "CANCELED", refundedFn: 10_000 });
    expect(await m.decideReceivedQuest({ id: sent.donationId, outcome: "CANCELED" })).toEqual({ status: "OK", questStatus: "CANCELED", refundedFn: 10_000 });
    expect(await m.decideMyQuest({ id: sent.donationId, outcome: "SUCCESS" })).toEqual({ status: "ALREADY_DECIDED", questStatus: "CANCELED" });
    expect(m.account.fnBalance).toBe(100_000);
    expect(m.walletStore.donations.find((d) => d.id === sent.donationId)!.status).toBe("REFUNDED");
  });

  it("keeps a quest past its time limit running until someone decides (2026-10-04 결정)", async () => {
    const m = await load();
    const q = m.mockQuests.items.find((x) => x.status === "IN_PROGRESS")!;
    q.createdAt = new Date(Date.now() - (q.timeLimitSec + 3_600) * 1000).toISOString();
    const row = (await m.getReceivedDonations({ kind: "quest", period: range, status: "IN_PROGRESS", query: "", page: 1 }))!.items.find((d) => d.id === q.id);
    expect(row).toMatchObject({ status: "IN_PROGRESS", questActions: ["SUCCESS", "FAILED", "CANCELED"] });
  });

  it("shows the running quests on the 퀘스트 overlay", async () => {
    const m = await load();
    const overlay = await import("@/services/creator/widgetOverlay");
    const { mockCreator } = await import("@/services/creator/mockCreatorStore");
    const read = async () => {
      const r = await overlay.getOverlayWidget("quest", mockCreator.integrationKey);
      if (r === "FORBIDDEN" || r.widget !== "quest") throw new Error("quest overlay");
      return r;
    };
    const before = await read();
    expect(before.quests).toHaveLength(2);
    expect(Date.parse(before.quests[0].endsAt)).toBeGreaterThan(Date.parse(before.serverNow) - 3_600_000);
    await m.decideReceivedQuest({ id: before.quests[0].id, outcome: "SUCCESS" });
    expect((await read()).quests.map((q) => q.id)).toEqual([before.quests[1].id]);
  });
});
