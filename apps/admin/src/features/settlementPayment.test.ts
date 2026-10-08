import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { AdminSettlementRow } from "@/types/adminApi";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock("@/lib/actions", () => ({}));

/** 정산 심사 · 지급 완료 (2026-10-08 결정): approved requests get the 지급 완료 form, paid ones show the record. */
const base: AdminSettlementRow = {
  id: "st-1",
  creatorName: "홍길동의 방송",
  creatorWithdrawn: false,
  status: "APPROVED",
  requestedAt: "2026-09-11",
  periodFrom: "2026-08-01",
  periodTo: "2026-08-31",
  amountFn: 50_000,
  feeFn: 3_300,
  netKrw: 46_700,
  payoutDate: "2026-09-30",
  registrationAtRequest: { memberType: "개인", registrant: "홍길동", holder: "홍길동", bankName: "예시은행", accountMasked: "********1234", code: "F0L0E0X0", submittedAt: "2026-09-01T00:00:00.000Z" },
  review: { at: "2026-09-12T00:00:00.000Z", by: "운영자", note: "서류 확인" },
  payment: null
};
const counts = { PENDING: 0, APPROVED: 1, PAID: 1, REJECTED: 0, FORFEITED: 0 };

async function render(rows: AdminSettlementRow[]) {
  const { SettlementReviewScreen } = await import("./settlements/SettlementReviewScreen");
  return renderToStaticMarkup(createElement(SettlementReviewScreen, { view: { rows, counts, registration: null, availableFn: 0 }, status: null }));
}

describe("정산 심사 · 지급 완료", () => {
  it("offers 지급 완료 with a length-limited transfer reference for an approved request", async () => {
    const html = await render([base]);
    expect(html).toMatch(/<input[^>]*aria-label="이체 참조번호"[^>]*maxLength="40"|<input[^>]*maxLength="40"[^>]*aria-label="이체 참조번호"/i);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>지급 완료 처리<\/button>/);
    expect(html).toContain("지급 완료 1");
    expect(html).toContain("전체 2");
  });

  it("shows the payment record of a paid request, and no form", async () => {
    const html = await render([{ ...base, status: "PAID", payment: { at: "2026-10-08T01:02:00.000Z", by: "운영자", reference: "TRF-0001" } }]);
    expect(html).toContain("지급 완료 2026-10-08 01:02 · 운영자 · 이체 참조 TRF-0001");
    expect(html).not.toContain(">지급 완료 처리</button>");
  });

  it("does not offer 지급 완료 for a withdrawn creator's approved request", async () => {
    const html = await render([{ ...base, creatorName: "홍길동", creatorWithdrawn: true }]);
    expect(html).toContain("탈퇴한 크리에이터의 정산이라 지급 완료로 처리할 수 없어요.");
    expect(html).not.toContain(">지급 완료 처리</button>");
  });
});
