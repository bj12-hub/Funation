import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 충전 내역 · FN Wallet on the FLEXTV backend (services/wallet/flextvHistory.ts through walletHistory.ts): FLEXTV's
 * offset-paged lists read back to the period's start, then filtered and paged like the mock's.
 */

vi.mock("@/lib/flextv/mode", () => ({ FLEXTV_BACKEND: true, FLEXTV_AUTH: true, FLEXTV_WALLET: true, FLEXTV_WEB_URL: "https://www.flextv.test" }));
vi.mock("@/lib/session", () => ({
  getSession: async () => ({ userId: "601924", nickname: "시청자", ssumnationId: "viewer01", avatarUrl: null, roles: ["SUPPORTER"] }),
  getFlextvAccessToken: async () => "member-token"
}));

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
/** FLEXTV keeps UTC; 03:00Z is noon in Korea. */
const day = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10) + "T03:00:00.000Z";
let paths: string[] = [];

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("FLEXTV_API_URL", "https://api.flextv.test");
  paths = [];
  const payments = Array.from({ length: 60 }, (_, i) => ({ id: 1000 - i, amount: 100, price: 11_000, payType: i % 2 ? 4 : 3, status: 9, statusName: "결제완료", createdAt: day(i * 2) }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = new URL(url);
      paths.push(`${u.pathname}${u.search}`);
      const offset = Number(u.searchParams.get("offset") ?? 0);
      if (u.pathname === "/api/luv/remain") return json({ amount: 4200 });
      if (u.pathname === "/api/shoppings/flex/payments") return json({ data: payments.slice(offset, offset + 50), count: payments.length });
      if (u.pathname === "/api/luv/sentluv-list")
        return json({ data: offset === 0 ? [{ id: 5, amount: 300, targetnick: "방송인", status: 9, createdAt: day(1) }, { id: 6, amount: 50, targetnick: "", status: 0, createdAt: day(3) }] : [], count: 2 });
      throw new Error(`unexpected ${u.pathname}`);
    })
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("충전 내역 (FLEXTV)", () => {
  it("maps FLEXTV's paid charges, and reads back only as far as the period needs", async () => {
    const { getChargeHistory } = await import("./walletHistory");
    const from = day(30).slice(0, 10);
    const to = day(0).slice(0, 10);
    const page = await getChargeHistory({ period: { preset: "month", from, to } });
    // Charges every 2 days: day 0 … day 30 → 16 rows; the first FLEXTV page of 50 already reaches past the start.
    expect(page?.totalCount).toBe(16);
    expect(page?.items[0]).toMatchObject({ id: "flextv-1000", fnAmount: 100, paidAmount: 11_000, methodLabel: "무통장입금", status: "COMPLETED", transactionId: "1000" });
    expect(paths.filter((p) => p.startsWith("/api/shoppings/flex/payments"))).toEqual(["/api/shoppings/flex/payments?offset=0&limit=50&option=all&mobile=false"]);
  });

  it("turns a unit price into the total paid", async () => {
    const { chargeRecordOf } = await import("./flextvHistory");
    expect(chargeRecordOf({ id: "1", at: "2026-10-25 12:00:00", rex: 1000, price: 110, payType: 4, status: 9, statusName: "" }).paidAmount).toBe(110_000);
    expect(chargeRecordOf({ id: "1", at: "2026-10-25 12:00:00", rex: 1000, price: 110_000, payType: 99, status: 9, statusName: "" })).toMatchObject({ paidAmount: 110_000, methodLabel: "결제" });
  });

  it("gives the balance as available, with nothing expiring", async () => {
    const { getWalletSummary } = await import("./walletHistory");
    expect(await getWalletSummary()).toEqual({ balance: 4200, available: 4200, expiring: 0 });
  });
});

describe("FN Wallet (FLEXTV)", () => {
  it("lists charges and donations together, newest first, and counts only finished donations as used", async () => {
    const { getWalletOverview } = await import("./walletHistory");
    const overview = await getWalletOverview({ period: "30" });
    expect(overview).toMatchObject({ available: 4200, locked: 0, totalUsed: 300, kind: "all", period: "30" });
    expect(overview?.entries.slice(0, 3).map((e) => [e.kind, e.description, e.deltaFn, e.statusLabel])).toEqual([
      ["CHARGE", "FN 충전 · 무통장입금", 100, "완료"],
      ["USE", "후원 · 방송인", -300, "완료"],
      ["CHARGE", "FN 충전 · 카카오페이", 100, "완료"]
    ]);
    const used = await getWalletOverview({ period: "30", kind: "USE" });
    expect(used?.entries.map((e) => [e.description, e.statusLabel])).toEqual([
      ["후원 · 방송인", "완료"],
      ["후원", "처리중"]
    ]);
  });
});
