import { describe, expect, it } from "vitest";
import { FlextvUnavailableError } from "./client";
import { mapCancel, mapWithdraw, maskAccount, readBank, readExchangeOpen, readWithdrawals } from "./settlement";

/** FLEXTV's 환전 answers (server/routes/api/luv, my/banks of FLEXTV's web repository), in its shapes. */

describe("the payout account", () => {
  it("never passes the full account number on", () => {
    const bank = readBank({ memberId: 601900, bankCode: 88, bankHolderName: "홍길동", bankAccount: "110-123-456789", createdAt: "2026-01-01T00:00:00.000Z" });
    expect(bank).toEqual({ bankCode: "88", holder: "홍길동", accountMasked: "********6789" });
    expect(JSON.stringify(bank)).not.toContain("123456");
    expect(maskAccount("1234")).toBe("****");
    expect(readBank(null)).toBeNull();
    expect(readBank([])).toBeNull();
    expect(readBank({ bankCode: "88", bankAccount: "" })).toBeNull();
  });

  it("reads FLEXTV's 환전 hours answer", () => {
    expect(readExchangeOpen("true")).toBe(true);
    expect(readExchangeOpen(true)).toBe(true);
    expect(readExchangeOpen("false")).toBe(false);
  });
});

describe("past requests", () => {
  it("reads FLEXTV's own ₩ figures per request, in KST", () => {
    const { items, count } = readWithdrawals({
      data: [
        { id: 42, payDiv: 1, exAmount: 1000, exRate: 80, exMoney: 80000, exVAT: 2640, exRealMoney: 77360, createdAt: "2026-10-24T02:00:00.000Z", status: 0 },
        { id: "x", exAmount: 5 }
      ],
      count: 7
    });
    expect(count).toBe(7);
    expect(items).toEqual([{ id: "42", at: "2026-10-24 11:00:00", rex: 1000, grossKrw: 80000, taxKrw: 2640, netKrw: 77360, status: 0 }]);
  });
});

describe("a request", () => {
  it("tells a clear refusal from FLEXTV's unclear catch-all", () => {
    expect(mapWithdraw({ status: 200, data: "OK" })).toEqual({ kind: "REQUESTED" });
    expect(mapWithdraw({ status: 200, data: { message: "이미 요청중인 처리가 있습니다." } })).toMatchObject({ kind: "REFUSED", reason: "OPEN_REQUEST" });
    expect(mapWithdraw({ status: 200, data: { message: "법인사업자 호스트의 경우 매주 수요일만 환전 신청이 가능합니다." } })).toMatchObject({ kind: "REFUSED", reason: "BUSINESS_DAY" });
    expect(mapWithdraw({ status: 200, data: { message: "개인호스트는 사업자 정산이 불가능 합니다." } })).toMatchObject({ kind: "REFUSED", reason: "NOT_BUSINESS" });
    expect(mapWithdraw({ status: 200, data: { message: "연락처가 비었습니다." } })).toMatchObject({ kind: "REFUSED", reason: "NO_PHONE" });
    expect(mapWithdraw({ status: 200, data: { message: "환전 가능 금액이 부족합니다." } })).toEqual({ kind: "REFUSED", reason: "OTHER", message: "환전 가능 금액이 부족합니다." });
    expect(mapWithdraw({ status: 200, data: { message: "요청이 실패하였습니다." } })).toEqual({ kind: "UNKNOWN" });
    expect(mapWithdraw({ status: 200, data: { message: undefined } })).toEqual({ kind: "UNKNOWN" });
    expect(mapWithdraw({ status: 401, data: "Unauthorized" })).toEqual({ kind: "UNAUTHORIZED" });
    expect(() => mapWithdraw({ status: 500, data: "InternalError" })).toThrow(FlextvUnavailableError);
  });

  it("maps a cancel", () => {
    expect(mapCancel({ status: 200, data: { success: true, data: [] } })).toEqual({ kind: "CANCELED" });
    expect(mapCancel({ status: 200, data: { error: "이미처리됨" } })).toEqual({ kind: "ALREADY_HANDLED" });
    expect(mapCancel({ status: 200, data: { error: "unknown" } })).toEqual({ kind: "REFUSED" });
  });
});
