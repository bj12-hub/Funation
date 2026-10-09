import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { AdminDashboard, AdminRefund, PaymentsView } from "@/types/adminApi";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock("@/lib/actions", () => ({}));

const FULL = { type: "FULL_CANCEL" as const, grossFn: 10_000, feeFn: 0, netFn: 10_000 };
const POLICY = { label: "기본값 (일반적인 기준, 법무 검토 전)", summary: "청약철회(결제일로부터 7일 이내 · 미사용) 전액 취소" };
const view = (refunds: AdminRefund[]): PaymentsView => ({ charges: [], refunds, balance: 0, refundPolicy: POLICY });

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
  charge: { chargedAt: "2026-09-30 10:00:00", fnAmount: 10_000, paidAmount: 11_000, methodLabel: "카드", transactionId: "TXN-1" },
  requested: FULL,
  approved: null,
  current: memberWithdrawn ? null : { ...FULL, chargeFn: 10_000, usedFn: 0, withinPeriod: true },
  hold: null
});

describe("처리 불가(탈퇴) refunds", () => {
  it("counts only decidable requests in the tab and lists the withdrawn ones apart, without the decision form", async () => {
    const { PaymentsScreen } = await import("./payments/PaymentScreens");
    const html = renderToStaticMarkup(createElement(PaymentsScreen, { view: view([refund("ch-new", false), refund("ch-old", true)]), tab: "refunds" }));
    expect(html).toMatch(/환불 요청 <span class="[^"]*warn[^"]*">1<\/span>/);
    const [main, apart] = html.split("처리 불가(탈퇴) 1</h2>");
    expect(apart).toBeDefined();
    expect(main.match(/<textarea/g)).toHaveLength(1); // one decision form, for the decidable request
    expect(apart).toContain("처리 불가(탈퇴)</span>");
    expect(apart).not.toContain("<textarea");

    const only = renderToStaticMarkup(createElement(PaymentsScreen, { view: view([refund("ch-old", true)]), tab: "refunds" }));
    expect(only).toContain("환불 요청 0");
  });

  it("leaves them out of the dashboard's 처리 대기 and mentions them apart", async () => {
    const { AdminDashboardScreen } = await import("./AdminScreens");
    const data: AdminDashboard = {
      creators: { total: 10, live: 3 },
      charges: { monthCount: 0, monthFn: 0, monthPaidKrw: 0, processing: 0 },
      donations: { monthCount: 0, monthFn: 0 },
      pending: { refunds: 0, refundsBlocked: 2, refundsHeld: 0, settlements: 0, settlementsHeld: 0, reports: 0, platformDonations: 0 },
      recentAudit: []
    };
    const html = renderToStaticMarkup(createElement(AdminDashboardScreen, { data }));
    expect(html).toMatch(/<span>환불 요청<\/span><strong>0건<\/strong>/);
    expect(html).toContain("처리 불가(탈퇴) 2건");
  });
});

/** 환불 정책 기본값: the card shows the type, fee and net the site computed, and what 승인 would apply now. */
describe("refund amounts on the request card", () => {
  it("shows the requested refund, the recomputed one when FN were used since, and the policy", async () => {
    const { PaymentsScreen } = await import("./payments/PaymentScreens");
    const changed: AdminRefund = { ...refund("ch-new", false), current: { type: "PARTIAL", chargeFn: 10_000, usedFn: 4_000, withinPeriod: true, grossFn: 6_000, feeFn: 600, netFn: 5_400 } };
    const html = renderToStaticMarkup(createElement(PaymentsScreen, { view: view([changed]), tab: "refunds" }));
    expect(html).toContain("10,000 FN · 11,000원 · 전액 취소");
    expect(html).toContain("<dt>요청 때 계산</dt><dd>전액 취소 · 회수 10,000 FN · 수수료 0 FN · 환불 10,000 FN</dd>");
    expect(html).toContain("<dt>지금 기준 (승인하면 적용)</dt><dd>수수료 공제 후 환불 · 회수 6,000 FN · 수수료 600 FN · 환불 5,400 FN");
    expect(html).toContain("요청 후 FN 사용으로 바뀜");
    expect(html).toContain(`환불 정책 · ${POLICY.label}: ${POLICY.summary}`);
  });

  it("offers only 거절 when nothing of the charge is left, and shows what an approval refunded", async () => {
    const { PaymentsScreen } = await import("./payments/PaymentScreens");
    const spent: AdminRefund = { ...refund("ch-new", false), current: { type: "NOT_REFUNDABLE", chargeFn: 10_000, usedFn: 10_000, withinPeriod: true, grossFn: 0, feeFn: 0, netFn: 0 } };
    const html = renderToStaticMarkup(createElement(PaymentsScreen, { view: view([spent]), tab: "refunds" }));
    expect(html).toContain("환불 불가 · 요청 후 이 충전의 FN을 모두 사용했어요");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>승인<\/button>/);
    expect(html).toContain("지금은 환불할 FN이 없어 승인할 수 없어요. 거절로 처리해 주세요.");

    const partial = { type: "PARTIAL" as const, grossFn: 6_000, feeFn: 600, netFn: 5_400 };
    const done: AdminRefund = { ...refund("ch-new", false), status: "APPROVED", decision: { at: "2026-10-05T00:00:00.000Z", by: "운영자", note: "정상 환불" }, approved: partial, current: null };
    const approved = renderToStaticMarkup(createElement(PaymentsScreen, { view: view([done]), tab: "refunds" }));
    expect(approved).toContain("10,000 FN · 11,000원 · 수수료 공제 후 환불");
    expect(approved).toContain("<dt>승인 때 적용</dt><dd>수수료 공제 후 환불 · 회수 6,000 FN · 수수료 600 FN · 환불 5,400 FN");
    expect(approved).not.toContain("<textarea");
  });
});
