import { describe, expect, it } from "vitest";
import { FlextvUnavailableError } from "./client";
import {
  depositBonus,
  kstStamp,
  mapCheckoutStatus,
  mapStart,
  paymentTime,
  readBlockedMethods,
  readDepositAccount,
  readDepositBonusRules,
  readPaymentProfile,
  readPayments,
  readSpends
} from "./wallet";

/** FLEXTV's 렉스 wallet answers (server/routes/api/shoppings, luv, guest of FLEXTV's web repository), in its shapes. */

describe("who may charge", () => {
  it("reads 본인인증, age, foreign accounts and VIP from the profile", () => {
    expect(readPaymentProfile({ luv: 0, profile: { PI: "Y", isChild: false, isCustomForeigner: false, isVip: true } })).toEqual({ verified: true, minor: false, blocked: false, vip: true });
    expect(readPaymentProfile({ profile: { PI: null, isChild: true } })).toEqual({ verified: false, minor: true, blocked: false, vip: false });
    expect(readPaymentProfile({ profile: { PI: 1, isCustomForeigner: true } })?.blocked).toBe(true);
    expect(readPaymentProfile({})).toBeNull();
  });

  it("reads the methods FLEXTV switched off", () => {
    const blocked = readBlockedMethods({ data: [{ id: 1, paytype: [4, 12], reason: "점검" }, { id: 2, paytype: ["3"] }] });
    expect([...blocked].sort()).toEqual(["kakaopay", "virtualaccount"]);
    expect(readBlockedMethods(null).size).toBe(0);
  });
});

describe("무통장", () => {
  it("reads the account to transfer to", () => {
    expect(readDepositAccount({ bank_code: "국민은행", bank_account: "123-45-6789", bank_holder_name: "(주)플렉스이엔엠" })).toEqual({ bank: "국민은행", account: "123-45-6789", holder: "(주)플렉스이엔엠" });
    expect(readDepositAccount({ bank_code: "국민은행" })).toBeNull();
  });

  it("adds FLEXTV's deposit bonus from the highest threshold met", () => {
    const rules = readDepositBonusRules([{ amount: 0, lexPoint: 0 }, { amount: 300, lexPoint: 1, honeyPoint: 0 }, { amount: 5000, lexPoint: 3 }]);
    expect(rules.map((r) => r.amount)).toEqual([5000, 300, 0]);
    expect(depositBonus(rules, 299)).toBe(0);
    expect(depositBonus(rules, 1000)).toBe(10);
    expect(depositBonus(rules, 5000)).toBe(150);
  });
});

describe("starting a charge", () => {
  const window = { ok: true, checkoutId: 9001, trxNo: "M1_x_100", pg: { type: "payletter", data: { url: "https://pg.example/pay", mobileUrl: "https://m.pg.example/pay" } } };

  it("opens Payletter's window, the mobile one on a phone", () => {
    expect(mapStart({ status: 200, data: window }, { mobile: false })).toEqual({ kind: "PAYMENT_WINDOW", checkoutId: "9001", payUrl: "https://pg.example/pay" });
    expect(mapStart({ status: 200, data: window }, { mobile: true })).toMatchObject({ payUrl: "https://m.pg.example/pay" });
  });

  it("files a 무통장 request, and passes FLEXTV's refusals on", () => {
    expect(mapStart({ status: 200, data: { ok: true, checkoutId: 9002, trxNo: "M1_y_100" } }, { mobile: false })).toEqual({ kind: "DEPOSIT", trxNo: "M1_y_100" });
    expect(mapStart({ status: 500, data: "Cannot process payment" }, { mobile: false })).toEqual({ kind: "NOT_ALLOWED" });
    expect(mapStart({ status: 400, data: "11,000원에 대한 대기중인 요청이 있습니다." }, { mobile: false })).toEqual({ kind: "REFUSED", message: "11,000원에 대한 대기중인 요청이 있습니다." });
  });

  it("never opens a window that is not https", () => {
    expect(() => mapStart({ status: 200, data: { ...window, pg: { type: "payletter", data: { url: "javascript:alert(1)" } } } }, { mobile: false })).toThrow(FlextvUnavailableError);
    expect(() => mapStart({ status: 502, data: null }, { mobile: false })).toThrow(FlextvUnavailableError);
  });

  it("stamps the request in Korea time, as FLEXTV's web does", () => {
    expect(paymentTime(new Date("2026-10-24T16:05:09Z"))).toEqual({ trdDt: "20261025", trdTm: "010509" });
  });
});

describe("completion", () => {
  it("is completed once FLEXTV credited the 렉스, with the checkout's amount", () => {
    expect(mapCheckoutStatus({ status: 200, data: { completed: true, checkout: { amount: 1000, price: 110, trxNo: "M1_x_100" }, paymenstCode: null } })).toEqual({
      kind: "COMPLETED",
      rex: 1000,
      price: 110_000,
      trxNo: "M1_x_100"
    });
    // Another member's checkout: FLEXTV leaves the checkout out.
    expect(mapCheckoutStatus({ status: 200, data: { completed: true, paymenstCode: null } })).toEqual({ kind: "COMPLETED", rex: null, price: null, trxNo: null });
  });

  it("reads a failure, and an abandoned payment as still pending", () => {
    expect(mapCheckoutStatus({ status: 200, data: { completed: false, paymenstCode: { code: "X", message: "카드 한도 초과" } } })).toEqual({ kind: "FAILED", message: "카드 한도 초과" });
    expect(mapCheckoutStatus({ status: 200, data: { completed: false, paymenstCode: null } })).toEqual({ kind: "PENDING" });
    expect(mapCheckoutStatus({ status: 204, data: null })).toEqual({ kind: "PENDING" });
  });
});

describe("history", () => {
  it("shows FLEXTV's UTC times in Korea time", () => {
    expect(kstStamp("2026-10-24T16:05:09.000Z")).toBe("2026-10-25 01:05:09");
    expect(kstStamp("2026-10-25 01:05:09")).toBe("2026-10-25 01:05:09");
    expect(kstStamp("nope")).toBeNull();
  });

  it("reads charges and donations, dropping rows it cannot read", () => {
    expect(readPayments({ data: [{ id: 7, amount: 100, price: 11000, payType: 4, status: 9, statusName: "결제완료", createdAt: "2026-10-24T03:00:00Z" }, { id: "x" }], count: 2 })).toEqual({
      items: [{ id: "7", at: "2026-10-24 12:00:00", rex: 100, price: 11000, payType: 4, status: 9, statusName: "결제완료" }],
      count: 2
    });
    expect(readSpends({ data: [{ id: 3, amount: 500, targetId: "bj01", targetnick: "방송인", status: 9, createdAt: "2026-10-24T03:00:00Z" }], count: 1 }).items).toEqual([
      { id: "3", at: "2026-10-24 12:00:00", rex: 500, targetNick: "방송인", status: 9 }
    ]);
  });
});
