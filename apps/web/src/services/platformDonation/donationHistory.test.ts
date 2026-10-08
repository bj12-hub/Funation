import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 후원 내역: platform transactions + creator-room (Direct) donations, filtered on the server. */
async function load() {
  const history = await import("./donationHistory");
  const { requestDonation } = await import("@/services/donations/donate");
  const { mockAccount } = await import("@/services/account/mockStore");
  mockAccount.fnBalance = 100_000;
  return { ...history, requestDonation };
}

describe("후원 내역", () => {
  beforeEach(() => resetMockStores());

  it("merges platform and Direct donations newest first, and needs a session", async () => {
    const m = await load();
    const sent = await m.requestDonation({ creatorId: "c1", hideProfile: false, type: "TEXT", amount: 1_000, message: "응원해요", voiceId: null, idempotencyKey: key(1) });
    expect(sent).toMatchObject({ status: "COMPLETED" });
    const all = (await m.getDonationHistory({ period: "all" }))!;
    expect(all.items.some((i) => i.source === "DIRECT" && i.productLabel === "일반 후원" && i.fnAmount === 1_000)).toBe(true);
    expect(all.items.some((i) => i.source === "SOOP" || i.source === "FLEXTV")).toBe(true);
    expect(all.items.map((i) => i.createdAt)).toEqual([...all.items.map((i) => i.createdAt)].sort().reverse());
    expect(all.balance).toBe(99_000);
    signIn(null);
    expect(await m.getDonationHistory({})).toBeNull();
  });

  it("starts a 재가입 account without the withdrawn account's platform and Direct donations", async () => {
    const m = await load();
    const { recordWithdrawal } = await import("@/services/account/withdrawalRecord");
    const { startNewAccount } = await import("@/services/account/rejoin");
    await m.requestDonation({ creatorId: "c1", hideProfile: false, type: "TEXT", amount: 1_000, message: "응원해요", voiceId: null, idempotencyKey: key(1) });
    expect((await m.getDonationHistory({ period: "all" }))!.items.length).toBeGreaterThan(1);

    // The mock's 재가입 keeps the user id: the new account must not see the old one's history.
    recordWithdrawal({ at: new Date().toISOString(), requestId: "w-test", forfeitedFn: 0, forfeitedEarningsFn: 0 });
    startNewAccount({ nickname: "다시왔어요", password: "newpass12!", marketing: false, phone: "010-0000-0000" }, new Date(Date.now() + 1_000));
    const after = (await m.getDonationHistory({ period: "all" }))!;
    expect(after.items).toEqual([]);
    expect(after.total).toBe(0);
  });

  it("sorts oldest first on request and sums only 완료 FN over every match", async () => {
    const m = await load();
    const newest = (await m.getDonationHistory({ period: "all" }))!;
    const oldest = (await m.getDonationHistory({ period: "all", sort: "oldest" }))!;
    expect(newest.sort).toBe("newest");
    expect(oldest.sort).toBe("oldest");
    expect(oldest.items.map((i) => i.transactionId)).toEqual([...newest.items].reverse().map((i) => i.transactionId));
    expect((await m.getDonationHistory({ sort: "random" }))!.sort).toBe("newest");
    expect(newest.total).toBe(newest.items.length);
    const completed = newest.items.filter((i) => i.status === "COMPLETED").reduce((sum, i) => sum + i.fnAmount, 0);
    expect(newest.completedFn).toBe(completed);
    expect(newest.items.some((i) => i.status !== "COMPLETED")).toBe(true); // the sum really leaves something out
    const failed = (await m.getDonationHistory({ period: "all", status: "FAILED" }))!;
    expect(failed.completedFn).toBe(0);
  });

  it("filters by tab, status and search, ignores unknown values and opens one transaction", async () => {
    const m = await load();
    const soop = (await m.getDonationHistory({ tab: "soop", period: "all" }))!;
    expect(soop.items.length).toBeGreaterThan(0);
    expect(soop.items.every((i) => i.source === "SOOP")).toBe(true);
    const odd = (await m.getDonationHistory({ tab: "hack", period: "7", status: "WHATEVER" }))!;
    expect([odd.tab, odd.period, odd.status]).toEqual(["all", "30", "all"]);
    expect((await m.getDonationHistory({ status: "constructor" }))!.status).toBe("all");
    const one = soop.items[0];
    const found = (await m.getDonationHistory({ tab: "soop", period: "all", q: one.transactionId.toUpperCase(), tx: one.transactionId }))!;
    expect(found.items.map((i) => i.transactionId)).toContain(one.transactionId);
    expect(found.selected?.transactionId).toBe(one.transactionId);
    expect((await m.getDonationHistory({ period: "all", status: one.status }))!.items.every((i) => i.status === one.status)).toBe(true);
    expect((await m.getDonationHistory({ period: "all", q: "x".repeat(200) }))!.q).toHaveLength(40);
  });
});
