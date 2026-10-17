import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, resetMockStores, verifyMockIdentity } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect ${to}`);
  },
  useRouter: () => ({ refresh() {}, push() {} })
}));

/**
 * `/creator/settlement` 정산 신청 card (Figma 429:98): its minimum line states the minimum 정산 신청 enforces — the
 * server's policy value (a Figma sample, TBD), in FN — instead of the Figma "10,000원", so the two cannot drift apart.
 */
const LINE = /최소 정산 신청 가능 금액은 ([\d,]+) FN 이상입니다 \(예시 값 · TBD\)\./;

/** A registered, 본인인증 done creator: the server's amount check answers 정산 신청 (no gate in front of it). */
async function registered() {
  await verifyMockIdentity();
  const { mockSettlement } = await import("@/services/creator/mockSettlementStore");
  mockSettlement.registration = {
    memberType: "INDIVIDUAL",
    registrant: "홍길동",
    holder: "홍길동",
    bankName: "예시은행",
    accountMasked: "********1234",
    code: "F0L0E0X0",
    submittedAt: new Date().toISOString()
  };
}

/** The page as the creator gets it (the server's overview into the screen). */
async function renderHome() {
  const { default: Page } = await import("@/app/creator/settlement/page");
  return renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
}

describe("정산 신청 카드 · 최소 정산 신청 금액", () => {
  beforeEach(() => resetMockStores());

  it("states the minimum 정산 신청 enforces, in FN and marked as a sample value", async () => {
    await registered();
    const html = await renderHome();
    const shown = html.match(LINE);
    expect(shown).not.toBeNull();
    expect(html).not.toContain("10,000원");
    // The number on the card is exactly where the server starts accepting a request.
    const minFn = Number(shown![1].replace(/,/g, ""));
    const { quoteSettlement } = await import("@/services/creator/settlementRequests");
    expect((await quoteSettlement(minFn)).status).toBe("OK");
    expect(await quoteSettlement(minFn - 1)).toEqual({ status: "INVALID", message: `${shown![1]} FN 이상 정산신청 가능합니다.` });
  }, 30_000);

  it("follows the server's policy value rather than a number of its own", async () => {
    await registered();
    const { MOCK_SETTLEMENT_POLICY } = await import("@/services/creator/mockSettlementStore");
    (MOCK_SETTLEMENT_POLICY as { minFn: number }).minFn = 55_500;
    expect((await renderHome()).match(LINE)?.[1]).toBe("55,500");
    const { quoteSettlement } = await import("@/services/creator/settlementRequests");
    expect((await quoteSettlement(55_499)).status).toBe("INVALID");
    expect((await quoteSettlement(55_500)).status).toBe("OK");
  }, 30_000);
});
