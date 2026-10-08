import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { AdminReportRow, AdminSettlementRow, AuditLogItem, DonationsView, PaymentsView } from "@/types/adminApi";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock("@/lib/actions", () => ({}));

/** 2026-10-08 결정: a withdrawn member shows with the original nickname and the 탈퇴 chip on every console screen. */
const BADGE = /<span class="[^"]*chipNeutral[^"]*">탈퇴<\/span>/g;
const after = (name: string) => new RegExp(`${name}(</a>)? <span class="[^"]*chipNeutral[^"]*">탈퇴</span>`);
const badges = (html: string) => html.match(BADGE)?.length ?? 0;

const charge = { chargedAt: "2026-10-01 10:00:00", methodLabel: "카드", fnAmount: 10_000, paidAmount: 11_000, status: "COMPLETED" as const, transactionId: "TXN-1", refund: null };
const payments: PaymentsView = {
  charges: [
    { ...charge, id: "ch-1", memberId: "u-hongGD123-w1", memberName: "홍길동", memberWithdrawn: true },
    { ...charge, id: "ch-2", memberId: "u-hongGD123", memberName: "다시왔어요", memberWithdrawn: false }
  ],
  refunds: [
    {
      chargeId: "ch-1",
      memberId: "u-hongGD123-w1",
      memberName: "홍길동",
      memberWithdrawn: true,
      requestedAt: "2026-10-01T00:00:00.000Z",
      reason: "실수",
      status: "REJECTED",
      decision: { at: "2026-10-02T00:00:00.000Z", by: "운영자", note: "거절" },
      charge: { chargedAt: charge.chargedAt, fnAmount: 10_000, paidAmount: 11_000, methodLabel: "카드", transactionId: "TXN-1" }
    }
  ],
  balance: 0
};

describe("withdrawn members in the console", () => {
  it("marks withdrawn members in 충전 내역, 환불 요청 and 후원 운영, not active ones", async () => {
    const { DonationsAdminScreen, PaymentsScreen } = await import("./payments/PaymentScreens");
    const charges = renderToStaticMarkup(createElement(PaymentsScreen, { view: payments, tab: "charges" }));
    expect(charges).toMatch(after("홍길동"));
    expect(badges(charges)).toBe(1);
    expect(renderToStaticMarkup(createElement(PaymentsScreen, { view: payments, tab: "refunds" }))).toMatch(after("홍길동"));

    const empty = { count: 0, fn: 0 };
    const donations: DonationsView = {
      rows: [{ id: "dn-1", donatedAt: "2026-10-01 10:00:00", creatorName: "하루봄", fnAmount: 1_000, typeLabel: "일반 후원", status: "COMPLETED", memberId: "u-hongGD123-w1", memberName: "홍길동", memberWithdrawn: true }],
      byStatus: { COMPLETED: { count: 1, fn: 1_000 }, PROCESSING: empty, FAILED: empty, REFUNDING: empty, REFUNDED: empty },
      byType: [{ typeLabel: "일반 후원", count: 1, fn: 1_000 }]
    };
    expect(renderToStaticMarkup(createElement(DonationsAdminScreen, { view: donations, status: null }))).toMatch(after("홍길동"));
  });

  it("marks a withdrawn creator in 정산 심사 and withdrawn authors and reporters in 신고 처리", async () => {
    const { SettlementReviewScreen } = await import("./settlements/SettlementReviewScreen");
    const row: AdminSettlementRow = {
      id: "st-1",
      creatorName: "홍길동",
      creatorWithdrawn: true,
      status: "FORFEITED",
      requestedAt: "2026-09-11",
      periodFrom: "2026-08-01",
      periodTo: "2026-08-31",
      amountFn: 50_000,
      feeFn: 0,
      netKrw: 0,
      payoutDate: null,
      registrationAtRequest: null,
      review: { at: "2026-10-01T00:00:00.000Z", by: "회원 탈퇴", note: "정산 대기 수익 소멸 (회원 동의)" }
    };
    const counts = { PENDING: 0, APPROVED: 0, REJECTED: 0, FORFEITED: 1 };
    const settlements = renderToStaticMarkup(createElement(SettlementReviewScreen, { view: { rows: [row], counts, registration: null, availableFn: 0 }, status: null }));
    expect(settlements).toMatch(after("홍길동"));

    const { ReportsScreen } = await import("./reports/ReportsScreen");
    const report: AdminReportRow = {
      id: "rp-1",
      target: { type: "POST", id: "p-1" },
      authorId: "u-hongGD123-w1",
      authorName: "홍길동",
      snapshot: "내용",
      reason: "SPAM",
      detail: "",
      reporterName: "새벽라디오",
      createdAt: "2026-10-01T00:00:00.000Z",
      status: "DISMISSED",
      resolution: { at: "2026-10-02T00:00:00.000Z", by: "운영자", action: "DISMISS", note: "위반 아님" },
      authorIsMember: true,
      authorWithdrawn: true,
      reporterWithdrawn: false
    };
    const html = renderToStaticMarkup(createElement(ReportsScreen, { view: { rows: [report], counts: { OPEN: 0, DISMISSED: 1, ACTIONED: 0 } }, status: "DISMISSED" }));
    expect(html).toMatch(after("작성자 홍길동"));
    expect(badges(html)).toBe(1);
    const both = renderToStaticMarkup(createElement(ReportsScreen, { view: { rows: [{ ...report, reporterWithdrawn: true }], counts: { OPEN: 0, DISMISSED: 1, ACTIONED: 0 } }, status: "DISMISSED" }));
    expect(both).toMatch(after("신고자 새벽라디오"));
  });

  it("links 감사 로그 member targets by name, with 탈퇴 for a withdrawn member", async () => {
    const { AuditLogScreen } = await import("./AdminScreens");
    const entry = (id: string, targetMember: AuditLogItem["targetMember"]): AuditLogItem => ({ id, at: "2026-10-01T00:00:00.000Z", actorId: "adm-1", actorName: "운영자", action: "MEMBER_SUSPEND", target: "member:u-hongGD123", reason: "1일 · 사유", targetMember });
    const html = renderToStaticMarkup(
      createElement(AuditLogScreen, {
        page: { items: [entry("au-1", { id: "u-hongGD123-w1", name: "홍길동", withdrawn: true }), entry("au-2", { id: "u-hongGD123", name: "다시왔어요", withdrawn: false })], total: 2, hasMore: false },
        show: 30
      })
    );
    expect(html).toContain('href="/members/u-hongGD123-w1"');
    expect(html).toMatch(after("홍길동"));
    expect(html).toContain('href="/members/u-hongGD123"');
    expect(badges(html)).toBe(1);
  });
});
