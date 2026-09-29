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
