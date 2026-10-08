import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { AdminDashboard, AdminRefund } from "@/types/adminApi";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock("@/lib/actions", () => ({}));

/** 2026-10-08 결정 D4b: a withdrawn account's waiting refund is 처리 불가(탈퇴) — outside 처리 대기, listed apart, undecidable. */
const refund = (chargeId: string, memberWithdrawn: boolean): AdminRefund => ({
  chargeId,
  memberId: memberWithdrawn ? "u-hongGD123-w1" : "u-hongGD123",
  memberName: memberWithdrawn ? "홍길동" : "다시왔어요",
  memberWithdrawn,
  requestedAt: "2026-10-01T00:00:00.000Z",
  reason: "",
  status: "REQUESTED",
  decision: null,
  charge: { chargedAt: "2026-09-30 10:00:00", fnAmount: 10_000, paidAmount: 11_000, methodLabel: "카드", transactionId: "TXN-1" }
});

describe("처리 불가(탈퇴) refunds", () => {
  it("counts only decidable requests in the tab and lists the withdrawn ones apart, without the decision form", async () => {
    const { PaymentsScreen } = await import("./payments/PaymentScreens");
    const html = renderToStaticMarkup(createElement(PaymentsScreen, { view: { charges: [], refunds: [refund("ch-new", false), refund("ch-old", true)], balance: 0 }, tab: "refunds" }));
    expect(html).toMatch(/환불 요청 <span class="[^"]*warn[^"]*">1<\/span>/);
    const [main, apart] = html.split("처리 불가(탈퇴) 1</h2>");
    expect(apart).toBeDefined();
    expect(main.match(/<textarea/g)).toHaveLength(1); // one decision form, for the decidable request
    expect(apart).toContain("처리 불가(탈퇴)</span>");
    expect(apart).not.toContain("<textarea");

    const only = renderToStaticMarkup(createElement(PaymentsScreen, { view: { charges: [], refunds: [refund("ch-old", true)], balance: 0 }, tab: "refunds" }));
    expect(only).toContain("환불 요청 0");
  });

  it("leaves them out of the dashboard's 처리 대기 and mentions them apart", async () => {
    const { AdminDashboardScreen } = await import("./AdminScreens");
    const data: AdminDashboard = {
      creators: { total: 10, live: 3 },
      charges: { monthCount: 0, monthFn: 0, monthPaidKrw: 0, processing: 0 },
      donations: { monthCount: 0, monthFn: 0 },
      pending: { refunds: 0, refundsBlocked: 2, settlements: 0, reports: 0 },
      recentAudit: []
    };
    const html = renderToStaticMarkup(createElement(AdminDashboardScreen, { data }));
    expect(html).toMatch(/<span>환불 요청<\/span><strong>0건<\/strong>/);
    expect(html).toContain("처리 불가(탈퇴) 2건");
  });
});
