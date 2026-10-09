import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/**
 * The mock's sample (seed) history — FN 충전내역 · 후원내역 (walletHistory.ts) and the sample 플랫폼 후원 — is dated once,
 * when the mock wallet store is created, not on every read: a dev server left running past midnight keeps it where it
 * was, before every record written live since. Days are October 2026, server time.
 */
const on = (day: number, hour: number, minute = 0, second = 0, ms = 0) => new Date(2026, 9, day, hour, minute, second, ms);
const EVER = { preset: "range" as const, from: "2000-01-01", to: "2099-12-31" };
const SAMPLE_ID = /^(ch|dn)\d+$|^TXN-SEED-/;

async function load() {
  const wallet = await import("./walletHistory");
  const { mockWallet } = await import("./mockWalletStore");
  const { mockPlatform } = await import("@/services/platformDonation/mockPlatformStore");
  const { mockAccount } = await import("@/services/account/mockStore");
  return { ...wallet, mockWallet, mockPlatform, account: mockAccount };
}
type M = Awaited<ReturnType<typeof load>>;

/** The sample rows' [id, date] as each reader gets them, by id. */
async function sampleDates(m: M) {
  const { getPaymentsView, getDonationsView } = await import("@/services/admin/payments");
  const pick = <T,>(rows: T[], id: (r: T) => string, at: (r: T) => string) =>
    rows
      .map((r) => [id(r), at(r)] as const)
      .filter(([i]) => SAMPLE_ID.test(i))
      .sort(([a], [b]) => a.localeCompare(b));
  const donationPages = await Promise.all((["basic", "quest", "game"] as const).map((category) => m.getDonationHistory({ period: EVER, category, all: true })));
  return {
    // Refund core, supporter identity and 내 후원 랭킹 read these two.
    charges: pick(m.listChargeRecords(), (c) => c.id, (c) => c.chargedAt),
    donations: pick(m.listDonationRecords(), (d) => d.id, (d) => d.donatedAt),
    // FN 충전내역 · 후원내역.
    chargePage: pick((await m.getChargeHistory({ period: EVER, all: true }))!.items, (c) => c.id, (c) => c.chargedAt),
    donationPage: pick(donationPages.flatMap((p) => p!.items), (d) => d.id, (d) => d.donatedAt),
    // The admin console (결제 · 환불, 후원 운영).
    adminCharges: pick((await getPaymentsView())!.charges, (c) => c.id, (c) => c.chargedAt),
    adminDonations: pick((await getDonationsView())!.rows, (d) => d.id, (d) => d.donatedAt),
    // The sample 플랫폼 후원 (후원 내역, 확인 중 후원).
    platform: pick(m.mockPlatform.transactions, (t) => t.transactionId, (t) => `${t.createdAt} · ${t.completedAt} · ${t.requestedAt}`)
  };
}

const dateOf = (rows: readonly (readonly [string, string])[], id: string) => rows.find(([i]) => i === id)?.[1];

describe("샘플 내역 날짜 (mock)", () => {
  beforeEach(() => {
    resetMockStores();
    vi.useFakeTimers({ toFake: ["Date"] });
  });
  afterEach(() => vi.useRealTimers());

  it("dates the sample history once, when the store is created: it does not move across midnight", async () => {
    vi.setSystemTime(on(9, 23, 30));
    const m = await load();
    const before = await sampleDates(m);
    expect(before.charges).toHaveLength(18);
    expect(before.donations).toHaveLength(16);
    expect(before.platform).toHaveLength(4);
    // Every reader sees the same dates.
    expect(before.chargePage).toEqual(before.charges);
    expect(before.adminCharges).toEqual(before.charges);
    expect(before.donationPage).toEqual(before.donations);
    expect(before.adminDonations).toEqual(before.donations);
    // Relative to the day the store was created, at the rows' own times.
    expect(dateOf(before.donations, "dn1")).toBe("2026-10-09 21:45:12");
    expect(dateOf(before.charges, "ch1")).toBe("2026-10-08 14:23:05");
    expect(dateOf(before.platform, "TXN-SEED-A81")).toMatch(/^2026-10-02 14:31 · 2026-10-02 14:31 · /);

    vi.setSystemTime(on(10, 0, 30));
    expect(await sampleDates(m)).toEqual(before);
    vi.setSystemTime(on(13, 12, 0));
    expect(await sampleDates(m)).toEqual(before);
  });

  it("never dates a sample record after the store was created: today's later rows move just before it, in order", async () => {
    // 09:00 — before dn1 (21:45:12) and dn2 (20:12:05), today's sample donations.
    vi.setSystemTime(on(9, 9, 0, 0, 400));
    const m = await load();
    expect(m.mockWallet.sampleAt).toBe(on(9, 9, 0, 0, 400).toISOString());
    const s = await sampleDates(m);
    for (const [id, at] of [...s.charges, ...s.donations]) expect(at < "2026-10-09 09:00:00", `${id} ${at}`).toBe(true);
    for (const t of m.mockPlatform.transactions) expect(t.requestedAt < m.mockWallet.sampleAt, t.transactionId).toBe(true);
    // Still today's two newest donations, in their order; every other row keeps its day and time.
    expect(dateOf(s.donations, "dn1")).toBe("2026-10-09 08:59:59");
    expect(dateOf(s.donations, "dn2")).toBe("2026-10-09 08:59:58");
    expect(dateOf(s.donations, "dn3")).toBe("2026-10-08 23:58:44");
    expect(dateOf(s.charges, "ch1")).toBe("2026-10-08 14:23:05");
    expect(s.donationPage).toEqual(s.donations);
    expect(s.adminDonations).toEqual(s.donations);

    // Created right after midnight: they move to the end of the day before, still after yesterday's own rows.
    resetMockStores();
    vi.setSystemTime(on(10, 0, 0, 0, 1));
    const n = await sampleDates(await load());
    expect(dateOf(n.donations, "dn1")).toBe("2026-10-09 23:59:59");
    expect(dateOf(n.donations, "dn2")).toBe("2026-10-09 23:59:58");
    expect(dateOf(n.donations, "dn3")).toBe("2026-10-09 23:58:44");
  });

  it("keeps records written after midnight later than the whole sample history (refund FIFO, FN Wallet)", async () => {
    vi.setSystemTime(on(9, 23, 30));
    const m = await load();
    const { agreeChargeTerms, requestCharge } = await import("./charge");
    const { recordCredit } = await import("./mockCreditStore");
    const { unusedPaidFnByCharge } = await import("./refundCore");
    expect((await agreeChargeTerms({ guardian: true, privacy: true, payment: true })).status).toBe("AGREED");

    // After midnight: 1,000 free FN (출석 보상), then a 10,000 FN charge.
    vi.setSystemTime(on(10, 0, 10));
    m.account.fnBalance += 1_000;
    recordCredit(1_000, "출석체크");
    vi.setSystemTime(on(10, 0, 20));
    const charged = await requestCharge({ amount: { customAmount: 10_000 }, methodId: "KAKAO_PAY", idempotencyKey: key(1) });
    if (charged.status !== "COMPLETED") throw new Error(charged.status);
    const chargeId = `ch-${charged.transactionId}`;

    // Late that day, past the times of the sample's "today" rows (dn1 21:45, dn2 20:12): no sample donation comes after
    // the live records, so none spends the free FN, and the new charge is untouched.
    vi.setSystemTime(on(10, 22, 0));
    const unused = unusedPaidFnByCharge();
    expect(unused.get(chargeId)).toBe(10_000);
    expect([...unused.values()].reduce((sum, n) => sum + n, 0)).toBe(m.account.fnBalance - 1_000);
    const entries = (await m.getWalletOverview({ kind: "all", period: "all" }))!.entries;
    expect(entries.slice(0, 3).map((e) => e.id)).toEqual([chargeId, expect.stringMatching(/^cr-/), "dn1"]);
  });
});
