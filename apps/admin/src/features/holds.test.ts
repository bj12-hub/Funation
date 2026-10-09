import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AUDIT_ACTION_LABEL, type AdminDashboard, type AdminRefund, type AdminSettlementRow, type AdminSettlementView, type SettlementFilter } from "@/types/adminApi";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock("@/lib/actions", () => ({}));

/** 보류 · 보류 해제 (2026-10-08 결정): a held request keeps its status, shows "보류" and its memo, and only offers 보류 해제. */
const HOLD = { at: "2026-10-08T01:02:00.000Z", by: "운영자", note: "입금 경로 확인 필요" };
const HOLD_CHIP = /<span class="[^"]*chipInfo[^"]*">보류<\/span>/;

const row = (id: string, status: AdminSettlementRow["status"], hold: AdminSettlementRow["hold"] = null): AdminSettlementRow => ({
  id,
  creatorName: "홍길동의 방송",
  creatorWithdrawn: false,
  status,
  requestedAt: "2026-09-11",
  periodFrom: "2026-08-01",
  periodTo: "2026-08-31",
  amountFn: 50_000,
  feeFn: 3_300,
  netKrw: 46_700,
  payoutDate: "2026-09-30",
  registrationAtRequest: { memberType: "개인", registrant: "홍길동", holder: "홍길동", bankName: "예시은행", accountMasked: "********1234", code: "F0L0E0X0", submittedAt: "2026-09-01T00:00:00.000Z" },
  review: status === "PENDING" ? null : { at: "2026-09-12T00:00:00.000Z", by: "운영자", note: "서류 확인" },
  payment: null,
  hold
});

async function settlements(rows: AdminSettlementRow[], counts: AdminSettlementView["counts"], held: number, status: SettlementFilter | null = null) {
  const { SettlementReviewScreen } = await import("./settlements/SettlementReviewScreen");
  return renderToStaticMarkup(createElement(SettlementReviewScreen, { view: { rows, counts, held, registration: null, availableFn: 0 }, status }));
}
const noCounts = { PENDING: 0, APPROVED: 0, PAID: 0, REJECTED: 0, FORFEITED: 0 };

describe("정산 심사 · 보류", () => {
  it("shows a held 심사 대기 request with both chips and the memo, and offers only 보류 해제", async () => {
    const html = await settlements([row("st-h", "PENDING", HOLD)], noCounts, 1, "HELD");
    expect(html).toMatch(HOLD_CHIP);
    expect(html).toContain("심사 대기</span>");
    expect(html).toContain("보류 메모: 입금 경로 확인 필요");
    // Korea time: 01:02 UTC is 10:02 KST (the console used to print the UTC clock of the ISO time).
    expect(html).toContain("보류 2026-10-08 10:02 · 운영자 · 보류를 해제할 때까지 승인 · 반려를 할 수 없어요.");
    expect(html).not.toContain('aria-label="처리 메모"');
    expect(html).not.toContain(">승인</button>");
    expect(html).toMatch(/<input[^>]*aria-label="보류 해제 메모"/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>보류 해제<\/button>/);
  });

  it("does not offer 지급 완료 for a held 승인 request", async () => {
    const html = await settlements([row("st-a", "APPROVED", HOLD)], noCounts, 1, "HELD");
    expect(html).toContain("보류를 해제할 때까지 지급 완료를 할 수 없어요.");
    expect(html).not.toContain(">지급 완료 처리</button>");
    expect(html).toMatch(/<button[^>]*>보류 해제<\/button>/);
  });

  it("offers 보류 next to 승인 · 반려 and 지급 완료, never on a decided request", async () => {
    const html = await settlements([row("st-p", "PENDING"), row("st-a", "APPROVED"), { ...row("st-paid", "PAID"), payment: { at: HOLD.at, by: "운영자", reference: "TRF-1" } }, row("st-r", "REJECTED")], noCounts, 0);
    expect(html).not.toMatch(HOLD_CHIP);
    expect(html.match(/aria-label="보류 메모"/g)).toHaveLength(2);
    expect(html.match(/>보류<\/button>/g)).toHaveLength(2);
    expect(html).toContain(">승인</button>");
    expect(html).toContain(">지급 완료 처리</button>");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>보류<\/button>/); // the memo is required
  });

  it("has a 보류 tab and counts held requests only there", async () => {
    const html = await settlements([], { ...noCounts, PENDING: 1, APPROVED: 4, REJECTED: 1 }, 2, "HELD");
    expect(html).toContain("심사 대기 1</a>");
    expect(html).toContain("승인 4</a>");
    expect(html).toContain("전체 8</a>");
    expect(html).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/settlements\?status=HELD"[^>]*>보류 2<\/a>/);
  });
});

const FULL = { type: "FULL_CANCEL" as const, grossFn: 10_000, feeFn: 0, netFn: 10_000, refundKrw: 11_000 };
const refund = (chargeId: string, hold: AdminRefund["hold"], memberWithdrawn = false): AdminRefund => ({
  chargeId,
  memberId: "u-hongGD123",
  memberName: "홍길동",
  memberWithdrawn,
  requestedAt: "2026-10-01T00:00:00.000Z",
  reason: "",
  status: "REQUESTED",
  decision: null,
  charge: { chargedAt: "2026-09-30 10:00:00", fnAmount: 10_000, paidAmount: 11_000, methodLabel: "카드", transactionId: `TXN-${chargeId}` },
  requested: FULL,
  approved: null,
  current: memberWithdrawn ? null : { ...FULL, chargeFn: 10_000, paidKrw: 11_000, usedFn: 0, withinPeriod: true },
  hold
});

describe("환불 요청 · 보류", () => {
  it("lists held requests apart as 보류 N, outside the tab's 처리 대기, with 보류 해제 only", async () => {
    const { PaymentsScreen } = await import("./payments/PaymentScreens");
    const view = { charges: [], refunds: [refund("ch-open", null), refund("ch-held", HOLD), refund("ch-old", null, true)], balance: 0, refundPolicy: { label: "기본값", summary: "요약" } };
    const html = renderToStaticMarkup(createElement(PaymentsScreen, { view, tab: "refunds" }));
    expect(html).toMatch(/환불 요청 <span class="[^"]*warn[^"]*">1<\/span> · 보류 1<\/a>/);
    const [main, rest] = html.split("보류 1</h2>");
    const [heldPart, blockedPart] = rest.split("처리 불가(탈퇴) 1</h2>");
    // 처리 대기: the decision form and 보류.
    expect(main.match(/<textarea/g)).toHaveLength(1);
    expect(main).toMatch(/aria-label="보류 메모"/);
    // 보류: the memo and 보류 해제, no decision form.
    expect(heldPart).toMatch(HOLD_CHIP);
    expect(heldPart).toContain("보류 메모: 입금 경로 확인 필요");
    expect(heldPart).toContain("보류를 해제할 때까지 승인 · 거절을 할 수 없어요.");
    expect(heldPart).not.toContain("<textarea");
    expect(heldPart).toMatch(/>보류 해제<\/button>/);
    // 처리 불가(탈퇴): nothing to do there.
    expect(blockedPart).not.toContain("<textarea");
    expect(blockedPart).not.toContain("보류 메모");
  });
});

describe("대시보드 · 보류", () => {
  it("keeps held requests out of 처리 대기 and mentions them apart", async () => {
    const { AdminDashboardScreen } = await import("./AdminScreens");
    const data: AdminDashboard = {
      creators: { total: 10, live: 3 },
      charges: { monthCount: 0, monthFn: 0, monthPaidKrw: 0, processing: 0 },
      donations: { monthCount: 0, monthFn: 0 },
      pending: { refunds: 1, refundsBlocked: 1, refundsHeld: 1, settlements: 0, settlementsHeld: 2, reports: 0, platformDonations: 0 },
      recentAudit: []
    };
    const html = renderToStaticMarkup(createElement(AdminDashboardScreen, { data }));
    expect(html).toMatch(/<span>환불 요청<\/span><strong[^>]*>1건<\/strong>/);
    expect(html).toContain("결제 · 환불 › 환불 요청에서 심사 · 보류 1건 · 처리 불가(탈퇴) 1건");
    expect(html).toMatch(/<span>정산 신청<\/span><strong>0건<\/strong>/);
    expect(html).toContain("정산 심사에서 처리 · 보류 2건");
  });

  it("names the hold actions in the audit log", () => {
    expect([AUDIT_ACTION_LABEL.SETTLEMENT_HOLD, AUDIT_ACTION_LABEL.SETTLEMENT_RELEASE, AUDIT_ACTION_LABEL.REFUND_HOLD, AUDIT_ACTION_LABEL.REFUND_RELEASE]).toEqual(["정산 보류", "정산 보류 해제", "환불 요청 보류", "환불 요청 보류 해제"]);
  });
});
