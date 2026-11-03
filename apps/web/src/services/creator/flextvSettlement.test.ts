import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Phase 5: 정산 as FLEXTV's 환전, against a stubbed FLEXTV API. */

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7", "user-agent": "Mozilla/5.0 (Windows NT 10.0)" })
}));
vi.mock("@/lib/flextv/mode", () => ({ FLEXTV_BACKEND: true, FLEXTV_AUTH: true, FLEXTV_STUDIO: true, FLEXTV_WEB_URL: "https://www.flextv.test" }));
const member = { creator: true };
vi.mock("@/lib/session", () => ({
  getCreatorSession: async () => (member.creator ? { userId: "601900", nickname: "방송인", ssumnationId: "bj01", avatarUrl: null, roles: ["SUPPORTER", "CREATOR"] } : null),
  getFlextvAccessToken: async () => "member-token"
}));

type Withdrawal = { id: number; exAmount: number; exMoney: number; exVAT: number; exRealMoney: number; createdAt: string; status: number };
let state: {
  PI: unknown;
  memberDiv: number;
  bank: unknown;
  open: string;
  exchangeable: number;
  withdrawals: Withdrawal[];
  /** What POST /api/luv/withdraw does: take the request and answer, or answer without taking it. */
  answer: { takes: boolean; body: unknown };
};
let posts: Record<string, unknown>[];
let cancels: string[];
let nextId: number;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ["Date"] });
  // Saturday 2026-10-24 10:00 KST.
  vi.setSystemTime(new Date("2026-10-24T01:00:00Z"));
  vi.stubEnv("FLEXTV_API_URL", "https://api.flextv.test");
  const g = globalThis as Record<string, unknown>;
  delete g.__ssumnationFlextvExchangeKeys;
  delete g.__ssumnationFlextvBanks;
  member.creator = true;
  posts = [];
  cancels = [];
  nextId = 100;
  state = {
    PI: { isAdult: true },
    memberDiv: 2,
    bank: { memberId: 601900, bankCode: "88", bankHolderName: "홍길동", bankAccount: "110-123-456789" },
    open: "true",
    exchangeable: 3000,
    withdrawals: [{ id: 41, exAmount: 800, exMoney: 64000, exVAT: 2112, exRealMoney: 61888, createdAt: "2026-10-01T03:00:00.000Z", status: 9 }],
    answer: { takes: true, body: "OK" }
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const u = new URL(url);
      switch (u.pathname) {
        case "/api/my/profile":
          return json({ luv: 0, profile: { id: 601900, memberDiv: state.memberDiv, status: 1, PI: state.PI, isChild: false } });
        case "/api/my/banks":
          return json(state.bank);
        case "/api/guest/refcode/bankCode":
          return json([{ key: 1, value: "88", text: "신한은행" }]);
        case "/api/guest/timeCheck/21":
          return new Response(state.open, { status: 200 });
        case "/api/luv/receivedluv-sum":
          return json({ todayamount: 0, exchangeamount: 800, pendingdepositamount: 0, accumulateamount: 3800, received: state.exchangeable });
        case "/api/luv/withdraw-list": {
          const offset = Number(u.searchParams.get("offset"));
          const limit = Number(u.searchParams.get("limit"));
          return json({ data: state.withdrawals.slice(offset, offset + limit), count: state.withdrawals.length });
        }
        case "/api/luv/withdraw": {
          const body = JSON.parse(String(init.body));
          posts.push(body);
          if (state.answer.takes) {
            state.withdrawals.unshift({ id: nextId++, exAmount: body.amount, exMoney: body.amount * 80, exVAT: Math.floor(body.amount * 80 * 0.033), exRealMoney: 0, createdAt: new Date().toISOString(), status: 0 });
            state.exchangeable -= body.amount;
          }
          return typeof state.answer.body === "string" ? new Response(state.answer.body, { status: 200 }) : json(state.answer.body);
        }
        case "/api/luv/withdraw-cancel": {
          const id = u.searchParams.get("withdrawId")!;
          cancels.push(id);
          const w = state.withdrawals.find((x) => String(x.id) === id);
          if (!w || w.status !== 0) return json({ error: "이미처리됨" });
          w.status = 7;
          return json({ success: true, data: [] });
        }
        default:
          throw new Error(`unexpected FLEXTV call ${u.pathname}`);
      }
    })
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const key = (n = 1) => `key-${String(n).padStart(16, "0")}`;

describe("정산 현황", () => {
  it("shows FLEXTV's figures and a masked account", async () => {
    const { getFlextvSettlementView } = await import("./flextvSettlement");
    const view = (await getFlextvSettlementView())!;
    expect(view).toMatchObject({ identityVerified: true, account: { bankName: "신한은행", holder: "홍길동", accountMasked: "********6789" }, exchangeable: 3000, exchanged: 800, minRex: 500, business: false, open: true, openRequest: false });
    expect(view.recent[0]).toMatchObject({ id: "41", rex: 800, netKrw: 61888, cancelable: false });
    expect(JSON.stringify(view)).not.toContain("123-456789");
  });
});

describe("정산 신청", () => {
  it("requests once per key and finds the request in FLEXTV's list", async () => {
    const { requestExchange } = await import("./flextvSettlement");
    const first = await requestExchange({ amount: 1000, business: false, idempotencyKey: key() });
    expect(first).toEqual({ status: "REQUESTED", requestId: "100" });
    expect(posts).toEqual([{ amount: 1000, businessType: 0 }]);
    // A retried 확인 returns the same request; the same key for another amount is refused.
    expect(await requestExchange({ amount: 1000, business: false, idempotencyKey: key() })).toEqual(first);
    expect(await requestExchange({ amount: 900, business: false, idempotencyKey: key() })).toEqual({ status: "CONFLICT" });
    expect(posts).toHaveLength(1);
  });

  it("takes one request at a time: a second key while the first is open is refused here", async () => {
    const { requestExchange } = await import("./flextvSettlement");
    const [a, b] = await Promise.all([requestExchange({ amount: 1000, business: false, idempotencyKey: key(1) }), requestExchange({ amount: 700, business: false, idempotencyKey: key(2) })]);
    expect(a.status).toBe("REQUESTED");
    expect(b).toMatchObject({ status: "INVALID", message: expect.stringContaining("처리 중인 정산 신청") });
    expect(posts).toHaveLength(1);
  });

  it("checks FLEXTV's rules before asking it", async () => {
    const { requestExchange } = await import("./flextvSettlement");
    expect(await requestExchange({ amount: 499, business: false, idempotencyKey: key(1) })).toMatchObject({ status: "INVALID", message: expect.stringContaining("500") });
    expect(await requestExchange({ amount: 3001, business: false, idempotencyKey: key(2) })).toMatchObject({ status: "INVALID" });
    expect(await requestExchange({ amount: 1000, business: true, idempotencyKey: key(3) })).toMatchObject({ status: "INVALID", message: expect.stringContaining("엔터 소속") });
    state.memberDiv = 3;
    expect(await requestExchange({ amount: 1000, business: true, idempotencyKey: key(4) })).toMatchObject({ status: "INVALID", message: expect.stringContaining("수요일") });
    state.open = "false";
    expect(await requestExchange({ amount: 1000, business: false, idempotencyKey: key(5) })).toMatchObject({ status: "INVALID", message: expect.stringContaining("오후 2시") });
    state.open = "true";
    state.bank = null;
    expect(await requestExchange({ amount: 1000, business: false, idempotencyKey: key(6) })).toEqual({ status: "NO_ACCOUNT" });
    state.PI = null;
    expect(await requestExchange({ amount: 1000, business: false, idempotencyKey: key(7) })).toEqual({ status: "IDENTITY_REQUIRED" });
    expect(await requestExchange({ amount: 1000, business: false, idempotencyKey: "short" })).toMatchObject({ status: "INVALID" });
    expect(posts).toHaveLength(0);
  });

  it("sends 사업자 정산 on a Wednesday before 14:00 for an 엔터 소속 streamer", async () => {
    vi.setSystemTime(new Date("2026-10-28T04:00:00Z")); // Wednesday 13:00 KST
    state.memberDiv = 3;
    const { requestExchange } = await import("./flextvSettlement");
    expect(await requestExchange({ amount: 1000, business: true, idempotencyKey: key() })).toMatchObject({ status: "REQUESTED" });
    expect(posts).toEqual([{ amount: 1000, businessType: 1 }]);
  });

  it("settles FLEXTV's unclear answer from its list, and asks again with the same key", async () => {
    const { requestExchange } = await import("./flextvSettlement");
    // Taken although FLEXTV answered "failed".
    state.answer = { takes: true, body: { message: "요청이 실패하였습니다." } };
    expect(await requestExchange({ amount: 1000, business: false, idempotencyKey: key(1) })).toEqual({ status: "REQUESTED", requestId: "100" });

    // Not taken: unknown for two minutes, then not requested.
    state.withdrawals[0].status = 9;
    state.answer = { takes: false, body: { message: "요청이 실패하였습니다." } };
    expect(await requestExchange({ amount: 600, business: false, idempotencyKey: key(2) })).toEqual({ status: "IN_PROGRESS" });
    vi.setSystemTime(new Date(Date.now() + 3 * 60 * 1000));
    expect(await requestExchange({ amount: 600, business: false, idempotencyKey: key(2) })).toMatchObject({ status: "INVALID", message: expect.stringContaining("마치지 못했어요") });
    expect(posts).toHaveLength(2);
  });

  it("passes FLEXTV's clear refusals on", async () => {
    state.answer = { takes: false, body: { message: "연락처가 비었습니다." } };
    const { requestExchange } = await import("./flextvSettlement");
    expect(await requestExchange({ amount: 1000, business: false, idempotencyKey: key() })).toMatchObject({ status: "INVALID", message: expect.stringContaining("연락처") });
  });

  it("is for the streamer only", async () => {
    member.creator = false;
    const { getFlextvSettlementView, requestExchange, getExchangeHistory, cancelExchange } = await import("./flextvSettlement");
    expect(await getFlextvSettlementView()).toBeNull();
    expect(await requestExchange({ amount: 1000, business: false, idempotencyKey: key() })).toEqual({ status: "UNAUTHORIZED" });
    expect(await getExchangeHistory({})).toBeNull();
    expect(await cancelExchange("41")).toEqual({ status: "UNAUTHORIZED" });
  });
});

describe("정산 관리", () => {
  it("cancels only the member's own 신청, and not on Wednesdays and Thursdays", async () => {
    state.withdrawals.unshift({ id: 55, exAmount: 600, exMoney: 48000, exVAT: 1584, exRealMoney: 46416, createdAt: "2026-10-24T00:30:00.000Z", status: 0 });
    const { cancelExchange, getExchangeHistory } = await import("./flextvSettlement");
    const history = (await getExchangeHistory({ page: "1" }))!;
    expect(history.items.map((w) => [w.id, w.cancelable])).toEqual([
      ["55", true],
      ["41", false]
    ]);

    expect(await cancelExchange("999")).toMatchObject({ status: "INVALID" });
    expect(await cancelExchange("41")).toMatchObject({ status: "INVALID" });
    expect(await cancelExchange("55 OR 1=1")).toMatchObject({ status: "INVALID" });
    expect(cancels).toEqual([]);

    vi.setSystemTime(new Date("2026-10-29T01:00:00Z")); // Thursday
    expect(await cancelExchange("55")).toMatchObject({ status: "INVALID", message: expect.stringContaining("목요일") });
    vi.setSystemTime(new Date("2026-10-30T01:00:00Z")); // Friday
    expect(await cancelExchange("55")).toEqual({ status: "CANCELED" });
    expect(cancels).toEqual(["55"]);
  });
});
