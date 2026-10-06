import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, resetMockStores } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 정산 준비 체크리스트 (code-first): derived on the server from identity and registration. */
describe("정산 체크리스트", () => {
  beforeEach(() => resetMockStores());

  it("reports each step and becomes ready when all are done", async () => {
    const { getSettlementOverview } = await import("./settlement");
    const { mockSettlement } = await import("./mockSettlementStore");
    const { mockAccount } = await import("@/services/account/mockStore");

    let o = (await getSettlementOverview())!;
    expect(o.checklist).toEqual({ identityVerified: false, documentsSubmitted: false, review: "NOT_SUBMITTED", bankRegistered: false, ready: false });

    mockSettlement.registration = {
      memberType: "INDIVIDUAL",
      registrant: "홍길동",
      holder: "홍길동",
      bankName: "신한은행",
      accountMasked: "*******8910",
      code: "TESTCODE",
      submittedAt: new Date().toISOString()
    };
    o = (await getSettlementOverview())!;
    expect(o.checklist).toMatchObject({ documentsSubmitted: true, review: "APPROVED", bankRegistered: true, ready: false });

    mockAccount.identity = { name: "홍길동", birthDate: "1990-01-01", verifiedAt: new Date().toISOString() };
    o = (await getSettlementOverview())!;
    expect(o.checklist.ready).toBe(true);
  });
});

/** A complete 개인사업자 form. Placeholder digits only (all zeros) — never real business or account numbers. */
function soleProprietorForm(holder: string) {
  const fd = new FormData();
  const fields: Record<string, string> = {
    memberType: "SOLE_PROPRIETOR",
    bizNo1: "000",
    bizNo2: "00",
    bizNo3: "00000",
    taxExempt: "과세사업자",
    ceoName: holder,
    bank: "신한은행",
    accountNo: "0000000000",
    holder,
    companyName: "예시상호",
    bizCategory: "서비스업",
    bizItem: "1인 미디어",
    phonePrefix: "010",
    phoneMid: "0000",
    phoneLast: "0000",
    emailLocal: "creator",
    emailDomain: "example.com",
    addressBase: "서울특별시 예시구",
    channelPlatform: "YOUTUBE",
    channelUrl: "https://example.com/channel"
  };
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  for (const k of ["bizLicense", "bankCopy"]) fd.set(k, new File(["%PDF"], `${k}.pdf`, { type: "application/pdf" }));
  return fd;
}

describe("정산 자료 등록", () => {
  beforeEach(() => resetMockStores());

  it("lets only one of two simultaneous submissions register (check and write in one step)", async () => {
    const { registerSettlement } = await import("./settlement");
    const { mockSettlement } = await import("./mockSettlementStore");
    mockSettlement.terms = { memberType: "SOLE_PROPRIETOR", acceptedAt: new Date().toISOString() };

    // Two tabs submit at once: the second must not pass the checks and overwrite the first.
    const [first, second] = await Promise.all([registerSettlement(soleProprietorForm("가나다")), registerSettlement(soleProprietorForm("라마바"))]);
    expect(first).toEqual({ status: "SUBMITTED" });
    expect(second.status).not.toBe("SUBMITTED");
    expect(mockSettlement.registration).toMatchObject({ memberType: "SOLE_PROPRIETOR", holder: "가나다", accountMasked: "******0000" });
    expect(await registerSettlement(soleProprietorForm("라마바"))).toEqual({ status: "NO_TERMS" });
  });
});
