import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 렉스 충전 on the FLEXTV backend (services/wallet/flextvCharge.ts through the actions of charge.ts), against a stubbed
 * FLEXTV API: who may charge, what FLEXTV is sent, the payment window, 무통장입금, and reading the outcome back.
 */

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name)
  }),
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7", "user-agent": "Mozilla/5.0 (Windows NT 10.0)" })
}));
vi.mock("@/lib/flextv/mode", () => ({ FLEXTV_BACKEND: true, FLEXTV_AUTH: true, FLEXTV_WALLET: true, FLEXTV_WEB_URL: "https://www.flextv.test" }));
const member = { userId: "601924" };
vi.mock("@/lib/session", () => ({
  getSession: async () => ({ userId: member.userId, nickname: "시청자", ssumnationId: "viewer01", avatarUrl: null, roles: ["SUPPORTER"] }),
  getFlextvAccessToken: async () => "member-token"
}));

type Call = { path: string; method: string; body: Record<string, unknown> | null; headers: Headers };
let calls: Call[] = [];
let profile: Record<string, unknown>;
let routes: Record<string, () => Response>;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("FLEXTV_API_URL", "https://api.flextv.test");
  jar.clear();
  calls = [];
  member.userId = "601924";
  const g = globalThis as Record<string, unknown>;
  delete g.__ssumnationFlextvChargeKeys;
  delete g.__ssumnationFlextvCheckouts;
  profile = { PI: "Y", isChild: false, isCustomForeigner: false, isVip: false };
  routes = {
    "/api/my/profile": () => json({ luv: 0, numMsg: 0, profile }),
    "/api/luv/remain": () => json({ amount: 2500 }),
    "/v2/api/guest/payment-failure": () => json({ data: [] }),
    "/api/shoppings/bankbook-point": () => json([{ amount: 300, lexPoint: 1 }, { amount: 0, lexPoint: 0 }]),
    "/api/guest/channeling-switching": () => json({ bank_code: "국민은행", bank_account: "123-45-6789", bank_holder_name: "(주)플렉스이엔엠" }),
    "/api/shoppings/buy": () => json({ ok: true, checkoutId: 9001, trxNo: "M1_x_100", pg: { type: "payletter", data: { url: "https://pg.example/pay", mobileUrl: "https://m.pg.example/pay" } } }),
    "/api/shoppings/coin": () => json({ ok: true, checkoutId: 9002, trxNo: "M1_y_100" }),
    "/api/shoppings/checkouts/9001/status": () => json({ completed: true, checkout: { amount: 1000, price: 110, trxNo: "M1_x_100" }, paymenstCode: null })
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const path = new URL(url).pathname;
      calls.push({ path, method: init.method ?? "GET", body: init.body ? JSON.parse(String(init.body)) : null, headers: new Headers(init.headers) });
      const route = routes[path];
      if (!route) throw new Error(`unexpected FLEXTV call ${path}`);
      return route();
    })
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const load = () => import("./charge");
const agree = async () => (await load()).agreeChargeTerms({ guardian: true, privacy: true, payment: true, marketing: false });
const key = () => crypto.randomUUID();

describe("충전 옵션 (FLEXTV)", () => {
  it("offers FLEXTV's presets at 110원 a 렉스, 카카오페이 and 무통장입금, and the member's 렉스", async () => {
    const options = await (await load()).getChargeOptions();
    expect(options).toMatchObject({ balance: 2500, termsAgreed: false, minAmount: 10, eligibility: "OK", availableMethods: ["KAKAO_PAY", "BANK_TRANSFER"] });
    expect(options?.packages.slice(0, 2)).toEqual([
      { id: "rex-100", fnAmount: 100, price: 11_000 },
      { id: "rex-300", fnAmount: 300, price: 33_000 }
    ]);
    expect(options?.depositBonus).toEqual([{ minAmount: 300, percent: 1 }]);
  });

  it("adds card and phone for FLEXTV's VIP members, and leaves out what FLEXTV switched off", async () => {
    profile.isVip = true;
    routes["/v2/api/guest/payment-failure"] = () => json({ data: [{ paytype: [3] }] });
    expect((await (await load()).getChargeOptions())?.availableMethods).toEqual(["KAKAO_PAY", "CARD", "PHONE"]);
  });

  it("tells who may not charge: no 본인인증, under 19", async () => {
    profile.PI = null;
    expect((await (await load()).getChargeOptions())?.eligibility).toBe("IDENTITY_REQUIRED");
    profile.PI = "Y";
    profile.isChild = true;
    expect((await (await load()).getChargeOptions())?.eligibility).toBe("MINOR");
  });

  it("prices a custom amount from 10 렉스", async () => {
    const { quoteCharge } = await load();
    expect(await quoteCharge(1234)).toEqual({ status: "OK", fnAmount: 1234, price: 135_740 });
    expect(await quoteCharge(9)).toEqual({ status: "INVALID", minAmount: 10 });
  });
});

describe("충전 요청 (FLEXTV)", () => {
  it("asks for the charge terms first, once per member", async () => {
    const { requestCharge } = await load();
    expect(await requestCharge({ amount: { packageId: "rex-1000" }, methodId: "KAKAO_PAY", idempotencyKey: key() })).toEqual({ status: "TERMS_REQUIRED" });
    expect(await agree()).toEqual({ status: "AGREED" });
    expect((await (await load()).getChargeOptions())?.termsAgreed).toBe(true);
    member.userId = "700001";
    expect((await (await load()).getChargeOptions())?.termsAgreed).toBe(false);
  });

  it("starts FLEXTV's checkout as its own web does and hands back the payment window", async () => {
    await agree();
    const { requestCharge } = await load();
    const result = await requestCharge({ amount: { packageId: "rex-1000" }, methodId: "KAKAO_PAY", idempotencyKey: key() });
    expect(result).toEqual({ status: "PAYMENT_STARTED", checkoutId: "9001", payUrl: "https://pg.example/pay", fnAmount: 1000, price: 110_000, methodId: "KAKAO_PAY" });
    const buy = calls.find((c) => c.path === "/api/shoppings/buy")!;
    expect(buy.body).toMatchObject({ productCode: 100, productName: "렉스", amount: 1000, price: 110, payMethod: "kakaopay", targetId: null, payDiv: 1, ver: 1 });
    expect(buy.body?.methodParams).toEqual({ trdDt: expect.stringMatching(/^\d{8}$/), trdTm: expect.stringMatching(/^\d{6}$/) });
    expect(buy.headers.get("authorization")).toBe("Bearer member-token");
    expect(buy.headers.get("user-agent")).toBe("Mozilla/5.0 (Windows NT 10.0)");
    expect(buy.headers.get("x-forwarded-for")).toBe("203.0.113.7");
  });

  it("opens one checkout per key: a double click gets the same window, another request with the key is refused", async () => {
    await agree();
    const { requestCharge } = await load();
    const k = key();
    const [a, b] = await Promise.all([
      requestCharge({ amount: { packageId: "rex-1000" }, methodId: "KAKAO_PAY", idempotencyKey: k }),
      requestCharge({ amount: { packageId: "rex-1000" }, methodId: "KAKAO_PAY", idempotencyKey: k })
    ]);
    expect(a).toEqual(b);
    expect(calls.filter((c) => c.path === "/api/shoppings/buy")).toHaveLength(1);
    expect(await requestCharge({ amount: { packageId: "rex-500" }, methodId: "KAKAO_PAY", idempotencyKey: k })).toEqual({ status: "CONFLICT" });
  });

  it("checks FLEXTV's rules again on the request, and offers card only to VIP members", async () => {
    await agree();
    const { requestCharge } = await load();
    profile.PI = null;
    expect(await requestCharge({ amount: { packageId: "rex-100" }, methodId: "KAKAO_PAY", idempotencyKey: key() })).toEqual({ status: "NOT_ELIGIBLE", eligibility: "IDENTITY_REQUIRED" });
    profile.PI = "Y";
    expect(await requestCharge({ amount: { packageId: "rex-100" }, methodId: "CARD", idempotencyKey: key() })).toEqual({ status: "FAILED", code: "METHOD-LOCK-403" });
    expect(calls.some((c) => c.path === "/api/shoppings/buy")).toBe(false);
  });

  it("refuses what FLEXTV would not sell", async () => {
    await agree();
    const { requestCharge } = await load();
    for (const input of [
      { amount: { customAmount: 9 }, methodId: "KAKAO_PAY", idempotencyKey: key() },
      { amount: { packageId: "fn-5000" }, methodId: "KAKAO_PAY", idempotencyKey: key() },
      { amount: { packageId: "rex-100" }, methodId: "NAVER_PAY", idempotencyKey: key() },
      { amount: { packageId: "rex-100" }, methodId: "BANK_TRANSFER", idempotencyKey: key() },
      { amount: { packageId: "rex-100" }, methodId: "BANK_TRANSFER", idempotencyKey: key(), depositorName: "<b>홍</b>" }
    ]) {
      expect(await requestCharge(input)).toEqual({ status: "INVALID" });
    }
  });

  it("files a 무통장입금 request with the account to transfer to and the bonus", async () => {
    await agree();
    const { requestCharge } = await load();
    expect(await requestCharge({ amount: { packageId: "rex-1000" }, methodId: "BANK_TRANSFER", idempotencyKey: key(), depositorName: " 홍길동 " })).toEqual({
      status: "DEPOSIT_REQUESTED",
      fnAmount: 1000,
      price: 110_000,
      bonusFn: 10,
      depositorName: "홍길동",
      account: { bank: "국민은행", number: "123-45-6789", holder: "(주)플렉스이엔엠" }
    });
    expect(calls.find((c) => c.path === "/api/shoppings/coin")?.body).toMatchObject({ amount: 1000, price: 110_000, payMethod: "virtualaccount", methodParams: { name: "홍길동" } });
  });

  it("explains a 무통장입금 request of the same amount still waiting", async () => {
    await agree();
    routes["/api/shoppings/coin"] = () => new Response("110,000원에 대한 대기중인 요청이 있습니다.", { status: 400 });
    const { requestCharge } = await load();
    expect(await requestCharge({ amount: { packageId: "rex-1000" }, methodId: "BANK_TRANSFER", idempotencyKey: key(), depositorName: "홍길동" })).toEqual({ status: "FAILED", code: "DEPOSIT-WAITING-409" });
  });
});

describe("결제 완료 확인 (FLEXTV)", () => {
  it("completes with FLEXTV's checkout and the new balance", async () => {
    await agree();
    const { requestCharge, checkChargeStatus } = await load();
    await requestCharge({ amount: { packageId: "rex-1000" }, methodId: "KAKAO_PAY", idempotencyKey: key() });
    expect(await checkChargeStatus("9001")).toEqual({ status: "COMPLETED", transactionId: "M1_x_100", fnAmount: 1000, price: 110_000, methodId: "KAKAO_PAY", balance: 2500 });
  });

  it("keeps waiting while the member pays, and refuses another member's checkout", async () => {
    await agree();
    routes["/api/shoppings/checkouts/9001/status"] = () => json({ completed: false, paymenstCode: null });
    const { requestCharge, checkChargeStatus } = await load();
    await requestCharge({ amount: { packageId: "rex-1000" }, methodId: "KAKAO_PAY", idempotencyKey: key() });
    expect(await checkChargeStatus("9001")).toEqual({ status: "PENDING" });
    member.userId = "700001";
    expect(await checkChargeStatus("9001")).toEqual({ status: "INVALID" });
    expect(await checkChargeStatus("../profile")).toEqual({ status: "INVALID" });
  });
});
