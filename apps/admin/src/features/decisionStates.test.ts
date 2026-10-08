import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/** Rendered while the decision is on its way to the site (the transition is pending). */
vi.mock("react", async (importOriginal) => ({ ...(await importOriginal<typeof import("react")>()), useTransition: () => [true, () => undefined] }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock("@/lib/actions", () => ({}));

/** 환불 · 정산 · 신고 decisions: while a decision is processing the form says so and both buttons are disabled. */
describe("decision forms while processing", () => {
  it("shows 처리 중 and disables the buttons", async () => {
    const { RefundDecision } = await import("./payments/RefundDecision");
    const { SettlementDecision } = await import("./settlements/SettlementDecision");
    const { ReportDecision } = await import("./reports/ReportDecision");
    for (const el of [createElement(RefundDecision, { chargeId: "ch1", current: { type: "FULL_CANCEL", chargeFn: 10_000, usedFn: 0, withinPeriod: true, grossFn: 10_000, feeFn: 0, netFn: 10_000 } }), createElement(SettlementDecision, { id: "st-1", canApprove: true }), createElement(ReportDecision, { id: "rp-1", canHide: true })]) {
      const html = renderToStaticMarkup(el);
      expect(html).toContain('role="status">처리 중…');
      expect(html.match(/<button[^>]*>/g)!.every((b) => b.includes("disabled"))).toBe(true);
    }
  });

  it("disables 콘텐츠 관리 수정 while a save is processing (it would replace the draft being saved)", async () => {
    const { ContentManager } = await import("./content/ContentManager");
    const notices = [{ id: "n-1", category: "GENERAL" as const, important: false, title: "공지", summary: "요약", body: ["본문"], date: "2026-10-08", views: 0 }];
    const faqs = [{ id: "faq-1", category: "GENERAL" as const, question: "질문인가요?", answer: null }];
    for (const tab of ["notices", "faq"] as const) {
      const edit = renderToStaticMarkup(createElement(ContentManager, { tab, notices, faqs })).match(/<button[^>]*>수정<\/button>/g)!;
      expect(edit).toHaveLength(1);
      expect(edit[0]).toContain("disabled");
    }
  });
});
