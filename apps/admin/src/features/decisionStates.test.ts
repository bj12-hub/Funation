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
    for (const el of [createElement(RefundDecision, { chargeId: "ch1" }), createElement(SettlementDecision, { id: "st-1", canApprove: true }), createElement(ReportDecision, { id: "rp-1", canHide: true })]) {
      const html = renderToStaticMarkup(el);
      expect(html).toContain('role="status">처리 중…');
      expect(html.match(/<button[^>]*>/g)!.every((b) => b.includes("disabled"))).toBe(true);
    }
  });
});
