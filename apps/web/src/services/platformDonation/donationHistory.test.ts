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

  it("filters by tab, status and search, ignores unknown values and opens one transaction", async () => {
    const m = await load();
    const soop = (await m.getDonationHistory({ tab: "soop", period: "all" }))!;
    expect(soop.items.length).toBeGreaterThan(0);
    expect(soop.items.every((i) => i.source === "SOOP")).toBe(true);
    const odd = (await m.getDonationHistory({ tab: "hack", period: "7", status: "WHATEVER" }))!;
    expect([odd.tab, odd.period, odd.status]).toEqual(["all", "30", "all"]);
    const one = soop.items[0];
    const found = (await m.getDonationHistory({ tab: "soop", period: "all", q: one.transactionId.toUpperCase(), tx: one.transactionId }))!;
    expect(found.items.map((i) => i.transactionId)).toContain(one.transactionId);
    expect(found.selected?.transactionId).toBe(one.transactionId);
    expect((await m.getDonationHistory({ period: "all", status: one.status }))!.items.every((i) => i.status === one.status)).toBe(true);
    expect((await m.getDonationHistory({ period: "all", q: "x".repeat(200) }))!.q).toHaveLength(40);
  });
});
