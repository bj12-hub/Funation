import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Phase 5: the dashboard, 수익 현황 and 받은 후원 of a FLEXTV streamer, against a stubbed FLEXTV API. */

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: async () => new Headers({ host: "ssumnation.test" })
}));
vi.mock("@/lib/flextv/mode", () => ({ FLEXTV_BACKEND: true, FLEXTV_AUTH: true, FLEXTV_STUDIO: true, FLEXTV_WEB_URL: "https://www.flextv.test" }));
const member = { creator: true };
vi.mock("@/lib/session", () => ({
  getCreatorSession: async () => (member.creator ? { userId: "601900", nickname: "방송인", ssumnationId: "bj01", avatarUrl: null, roles: ["SUPPORTER", "CREATOR"] } : null),
  getFlextvAccessToken: async () => "member-token"
}));

type Row = { id: number; amount: number; memberId: string; membernick: string; productName: string | null; status: number; createdAt: string };
let rows: Row[];
let listCalls: URLSearchParams[];
/** KST wall time → FLEXTV's ISO (UTC). */
const kst = (stamp: string) => new Date(`${stamp.replace(" ", "T")}+09:00`).toISOString();
const gift = (id: number, at: string, amount: number, donor: string, status = 9, productName: string | null = null): Row => ({ id, amount, memberId: `id-${donor}`, membernick: donor, productName, status, createdAt: kst(at) });

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ["Date"] });
  // Sunday 2026-10-25 12:00 KST: the week started Monday the 19th, the month on the 1st.
  vi.setSystemTime(new Date("2026-10-25T03:00:00Z"));
  vi.stubEnv("FLEXTV_API_URL", "https://api.flextv.test");
  delete (globalThis as Record<string, unknown>).__ssumnationFlextvReceived;
  member.creator = true;
  listCalls = [];
  rows = [
    gift(6, "2026-10-25 10:00:00", 100, "팬A"),
    gift(5, "2026-10-24 21:00:00", 300, "팬B", 1, "장미"),
    gift(4, "2026-10-20 09:00:00", 50, "팬A"),
    gift(3, "2026-10-10 15:00:00", 1000, "팬C", 19),
    gift(2, "2026-10-05 12:00:00", 200, "팬B", 0),
    gift(1, "2026-09-30 23:30:00", 500, "팬C")
  ];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = new URL(url);
      if (u.pathname === "/api/luv/receivedluv-sum")
        return new Response(JSON.stringify({ todayamount: 100, exchangeamount: 2000, pendingdepositamount: 500, accumulateamount: 9000, received: 1150 }), { status: 200 });
      if (u.pathname !== "/api/luv/receivedluv-list") throw new Error(`unexpected FLEXTV call ${u.pathname}`);
      const sp = u.searchParams;
      listCalls.push(sp);
      const from = sp.get("selectedStartDay");
      const to = sp.get("selectedEndDay");
      const name = sp.get("title");
      // FLEXTV compares its DATETIME (KST) with the text.
      const local = (r: Row) => new Date(Date.parse(r.createdAt) + 9 * 3_600_000).toISOString().slice(0, 19).replace("T", " ");
      const matching = rows.filter((r) => (!from || (local(r) >= from && local(r) <= to!)) && (!name || r.membernick === name));
      const offset = Number(sp.get("offset"));
      const limit = Number(sp.get("limit"));
      return new Response(JSON.stringify({ data: matching.slice(offset, offset + limit), count: matching.length }), { status: 200 });
    })
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the dashboard", () => {
  it("adds up what FLEXTV counts, by calendar week and month (KST)", async () => {
    const { getDashboardSummary } = await import("./creatorStudio");
    const s = (await getDashboardSummary())!;
    expect(s.unit).toBe("FN");
    expect(s.received.today).toEqual({ amount: 100, count: 1 });
    expect(s.received.week).toEqual({ amount: 450, count: 3 });
    // 팬C's 1,000 was not counted by FLEXTV (status 19); 9월 30일 is last month.
    expect(s.received.month).toEqual({ amount: 650, count: 4 });
    expect(s.received.total).toEqual({ amount: 9000, count: null });
    expect(s.settlement).toEqual({ availableFn: 1150, earnedFn: 9000, withdrawnFn: 2000 });
    expect(s.topDonors).toEqual([
      { rank: 1, donor: "팬B", amount: 500 },
      { rank: 2, donor: "팬A", amount: 150 }
    ]);
  });

  it("fills the period stats, chart, recent list and rankings", async () => {
    const { getCreatorDashboard, parseStatsPeriod } = await import("./creatorStudio");
    const d = (await getCreatorDashboard(parseStatsPeriod({ period: "week" })))!;
    expect(d).toMatchObject({ unit: "FN", partial: false, stats: { count: 3, revenue: 450, donors: 2 } });
    expect(d.series).toHaveLength(7);
    expect(d.series.at(-1)).toEqual({ label: "10.25", amount: 100 });
    expect(d.recent.map((r) => [r.donor, r.amount])).toEqual([
      ["팬A", 100],
      ["팬B", 300],
      ["팬A", 50],
      ["팬B", 200],
      ["팬C", 500]
    ]);
    expect(d.recent[1]).toMatchObject({ message: "장미", createdAt: "2026-10-24T21:00:00+09:00" });
    expect(d.rankings.day).toEqual([{ rank: 1, donor: "팬A", amount: 100 }]);
    expect(d.rankings.week.map((r) => r.donor)).toEqual(["팬B", "팬A"]);
    expect(d.banners).toEqual({ event: null, ad: null });
    // The week sits inside the month already read: no second read of the list for it.
    expect(listCalls.filter((sp) => sp.get("selectedStartDay")).map((sp) => sp.get("selectedStartDay"))).toEqual(["2026-10-01 00:00:00"]);
  });

  it("marks a period with more 후원 than it adds up, reading at most 40 pages", async () => {
    rows = Array.from({ length: 2_100 }, (_, i) => gift(10_000 - i, "2026-10-25 09:00:00", 1, `팬${i % 30}`));
    const { getCreatorDashboard, parseStatsPeriod } = await import("./creatorStudio");
    const d = (await getCreatorDashboard(parseStatsPeriod({ period: "today" })))!;
    expect(d.partial).toBe(true);
    expect(d.stats.count).toBe(2_000);
    expect(listCalls.filter((sp) => sp.get("selectedStartDay"))).toHaveLength(40);
  });

  it("is for the streamer only", async () => {
    member.creator = false;
    const { getCreatorDashboard, getDashboardSummary, getRevenueOverview, parseStatsPeriod } = await import("./creatorStudio");
    expect(await getCreatorDashboard(parseStatsPeriod({}))).toBeNull();
    expect(await getDashboardSummary()).toBeNull();
    expect(await getRevenueOverview()).toBeNull();
  });
});

describe("수익 현황", () => {
  it("shows 30 days, six calendar months and FLEXTV's totals, without a made-up split", async () => {
    const { getRevenueOverview } = await import("./creatorStudio");
    const r = (await getRevenueOverview())!;
    expect(r).toMatchObject({ unit: "FN", partial: false, totalRevenue: 9000, unsettledFn: 1150, today: { amount: 100, count: 1 }, thisMonth: 650, bySource: null });
    expect(r.daily).toHaveLength(30);
    expect(r.daily.at(-1)).toEqual({ label: "10/25", amount: 100 });
    expect(r.monthly.map((m) => [m.label, m.amount])).toEqual([
      ["5월", 0],
      ["6월", 0],
      ["7월", 0],
      ["8월", 0],
      ["9월", 500],
      ["10월", 650]
    ]);
  });
});

describe("받은 후원", () => {
  it("pages FLEXTV's list and never sends the senders' 아이디", async () => {
    const { flextvReceivedPage } = await import("./flextvEarnings");
    const page = (await flextvReceivedPage({ period: { preset: "1m", from: "2026-10-01", to: "2026-10-25" }, nickname: "", page: 1 }))!;
    expect(page).toMatchObject({ page: 1, totalPages: 1, total: 5, sum: { amount: 650, count: 4, partial: false } });
    expect(page.items.map((i) => i.id)).toEqual(["6", "5", "4", "3", "2"]);
    expect(page.items[3]).toMatchObject({ rex: 1000, counted: false });
    expect(JSON.stringify(page)).not.toContain("id-팬");

    const searched = (await flextvReceivedPage({ period: { preset: "1m", from: "2026-10-01", to: "2026-10-25" }, nickname: " 팬B ", page: 9 }))!;
    expect(searched).toMatchObject({ nickname: "팬B", page: 1, total: 2, sum: null });
  });
});
