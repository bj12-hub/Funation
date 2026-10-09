import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { AdminDashboard, AdminRefund, PaymentsView } from "@/types/adminApi";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock("@/lib/actions", () => ({}));

const FULL = { type: "FULL_CANCEL" as const, grossFn: 10_000, feeFn: 0, netFn: 10_000, refundKrw: 11_000 };
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
  current: memberWithdrawn ? null : { ...FULL, chargeFn: 10_000, paidKrw: 11_000, usedFn: 0, withinPeriod: true },
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
    const changed: AdminRefund = { ...refund("ch-new", false), current: { type: "PARTIAL", chargeFn: 10_000, paidKrw: 11_000, usedFn: 4_000, withinPeriod: true, grossFn: 6_000, feeFn: 600, netFn: 5_400, refundKrw: 5_940 } };
    const html = renderToStaticMarkup(createElement(PaymentsScreen, { view: view([changed]), tab: "refunds" }));
    expect(html).toContain("10,000 FN · 11,000원 · 전액 취소");
    expect(html).toContain("<dt>요청 때 계산</dt><dd>전액 취소 · 회수 10,000 FN · 수수료 0 FN · 환불 10,000 FN · 11,000원</dd>");
    expect(html).toContain("<dt>지금 기준 (승인하면 적용)</dt><dd>수수료 공제 후 환불 · 회수 6,000 FN · 수수료 600 FN · 환불 5,400 FN · 5,940원");
    expect(html).toContain(" · 요청 후 FN 사용으로 줄어듦</span>");
    expect(html).toContain(`환불 정책 · ${POLICY.label}: ${POLICY.summary}`);
    // 원화 환불 금액 (2026-10-08 결정) is the site's and recorded; only the payout per payment method is TBD.
    expect(html).toContain("승인하면 FN을 회수하고 원화 환불 금액을 함께 기록해요. 결제 수단별 환불 방식은 결제 대행사 연동 후 확정이라 실제 결제 취소 · 송금은 아직 하지 않아요 (TBD).");
    expect(html).not.toContain("승인 시 FN 회수만 반영돼요");
  });

  it("offers only 거절 when nothing of the charge is left, and shows what an approval refunded", async () => {
    const { PaymentsScreen } = await import("./payments/PaymentScreens");
    const spent: AdminRefund = { ...refund("ch-new", false), current: { type: "NOT_REFUNDABLE", chargeFn: 10_000, paidKrw: 11_000, usedFn: 10_000, withinPeriod: true, grossFn: 0, feeFn: 0, netFn: 0, refundKrw: 0 } };
    const html = renderToStaticMarkup(createElement(PaymentsScreen, { view: view([spent]), tab: "refunds" }));
    expect(html).toContain("환불 불가 · 요청 후 이 충전의 FN을 모두 사용했어요");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>승인<\/button>/);
    expect(html).toContain("지금은 환불할 FN이 없어 승인할 수 없어요. 거절로 처리해 주세요.");

    const partial = { type: "PARTIAL" as const, grossFn: 6_000, feeFn: 600, netFn: 5_400, refundKrw: 5_940 };
    const done: AdminRefund = { ...refund("ch-new", false), status: "APPROVED", decision: { at: "2026-10-05T00:00:00.000Z", by: "운영자", note: "정상 환불" }, approved: partial, current: null };
    const approved = renderToStaticMarkup(createElement(PaymentsScreen, { view: view([done]), tab: "refunds" }));
    expect(approved).toContain("10,000 FN · 11,000원 · 수수료 공제 후 환불");
    expect(approved).toContain("<dt>승인 때 적용</dt><dd>수수료 공제 후 환불 · 회수 6,000 FN · 수수료 600 FN · 환불 5,400 FN · 5,940원");
    expect(approved).toContain(" · 요청 후 FN 사용으로 줄어듦</span>");
    expect(approved).not.toContain("<textarea");
  });

  /**
   * 2026-10-09 결정: the note after a changed refund says which way it went. FN came back since the request (퀘스트 실패 ·
   * 취소, a failed 플랫폼 후원's FN 반환) → 늘어남, not "FN 사용으로".
   */
  it("says the refund grew when FN came back since the request, shrank when FN were used, and 요청 때와 같아요 when equal", async () => {
    const { PaymentsScreen } = await import("./payments/PaymentScreens");
    const render = (r: AdminRefund) => renderToStaticMarkup(createElement(PaymentsScreen, { view: view([r]), tab: "refunds" }));
    // Requested while 4,000 FN of the charge were held by a quest; the quest failed and gave them back.
    const PART = { type: "PARTIAL" as const, grossFn: 6_000, feeFn: 600, netFn: 5_400, refundKrw: 5_940 };
    const quote = (a: { type: "FULL_CANCEL" | "PARTIAL"; grossFn: number; feeFn: number; netFn: number; refundKrw: number }) => ({ ...a, chargeFn: 10_000, paidKrw: 11_000, usedFn: 10_000 - a.grossFn, withinPeriod: false });
    const back = { type: "PARTIAL" as const, grossFn: 10_000, feeFn: 1_000, netFn: 9_000, refundKrw: 9_900 };
    const grew = render({ ...refund("ch-new", false), requested: PART, current: quote(back) });
    expect(grew).toContain("<dt>지금 기준 (승인하면 적용)</dt><dd>수수료 공제 후 환불 · 회수 10,000 FN · 수수료 1,000 FN · 환불 9,000 FN · 9,900원");
    expect(grew).toContain(" · 요청 후 FN이 돌아와 늘어남</span>");
    expect(grew).not.toContain("FN 사용으로");

    // Within the 청약철회 period and all of it back: the type turns 전액 취소 — still 늘어남.
    const whole = render({ ...refund("ch-new", false), requested: PART, current: { ...quote(FULL), withinPeriod: true } });
    expect(whole).toContain(" · 요청 후 FN이 돌아와 늘어남</span>");

    // Approved after the FN came back: the 승인 때 적용 line says the same.
    const done = render({ ...refund("ch-new", false), requested: PART, status: "APPROVED", decision: { at: "2026-10-05T00:00:00.000Z", by: "운영자", note: "정상 환불" }, approved: back, current: null });
    expect(done).toContain("<dt>승인 때 적용</dt><dd>수수료 공제 후 환불 · 회수 10,000 FN · 수수료 1,000 FN · 환불 9,000 FN · 9,900원<span");
    expect(done).toContain(" · 요청 후 FN이 돌아와 늘어남</span>");

    // Used further since the request: 줄어듦.
    const less = { type: "PARTIAL" as const, grossFn: 2_000, feeFn: 200, netFn: 1_800, refundKrw: 1_980 };
    const shrank = render({ ...refund("ch-new", false), requested: PART, current: quote(less) });
    expect(shrank).toContain(" · 요청 후 FN 사용으로 줄어듦</span>");
    expect(shrank).not.toContain("늘어남");

    // Unchanged: 요청 때와 같아요 on the current line, nothing after an approval that matched.
    const unchanged = render({ ...refund("ch-new", false), requested: PART, current: quote(PART) });
    expect(unchanged).toContain(" · 요청 때와 같아요</span>");
    expect(unchanged).not.toMatch(/줄어듦|늘어남|바뀜/);
    const matched = render({ ...refund("ch-new", false), requested: PART, status: "APPROVED", decision: { at: "2026-10-05T00:00:00.000Z", by: "운영자", note: "정상 환불" }, approved: PART, current: null });
    expect(matched).toContain("<dt>승인 때 적용</dt><dd>수수료 공제 후 환불 · 회수 6,000 FN · 수수료 600 FN · 환불 5,400 FN · 5,940원</dd>");
  });
});
