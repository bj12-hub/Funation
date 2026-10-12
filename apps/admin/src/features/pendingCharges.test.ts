import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AUDIT_ACTION_LABEL, type AdminDashboard, type PendingChargeRow } from "@/types/adminApi";

const site = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }), usePathname: () => "/", redirect: vi.fn() }));
vi.mock("@/lib/actions", () => ({}));
// For the Server Action itself (loaded with vi.importActual): the operator and the site's admin API.
vi.mock("@/lib/session", () => ({ getOperator: async () => ({ id: "adm-1", name: "운영자" }) }));
vi.mock("@/lib/siteApi", () => ({ siteSend: site.send, SiteApiError: class extends Error {} }));

/** 처리 중 충전 (2026-10-12 결정): what the console offers for an FN 충전 still 처리중, and what it shows once decided. */
const render = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

const pc = (over: Partial<PendingChargeRow> = {}): PendingChargeRow => ({
  chargeId: "ch1",
  // The site's zone-less Korea-time stamp: 2026-10-11 14:23 KST whatever the zone the test runs in.
  chargedAt: "2026-10-11 14:23:05",
  methodLabel: "신용카드",
  fnAmount: 10_000,
  paidAmount: 11_000,
  transactionId: "TXN-20261011-09124",
  memberId: "u-hongGD123",
  memberName: "홍길동",
  memberWithdrawn: false,
  resolution: null,
  ...over
});
const decided = (outcome: "COMPLETED" | "CANCELLED", result: "CREDITED" | "NOT_CREDITED" | "CANCELLED") => ({
  outcome,
  result,
  at: "2026-10-12T06:00:00.000Z",
  operator: "운영자",
  note: "결제 대행사 관리자 화면 확인"
});

describe("처리 중 충전 screen", () => {
  it("lists a waiting charge with its amount, method, member, request time and transaction id, and the decision form", async () => {
    const { PendingChargesScreen } = await import("./payments/PendingChargesScreen");
    const html = render(createElement(PendingChargesScreen, { view: { waiting: [pc()], resolved: [] } }));
    expect(html).toContain("<h1");
    expect(html).toContain(">처리 중 충전</h1>");
    expect(html).toContain(
      "결제 대행사의 결제 확인이 오지 않은 충전이에요. 결제 대행사에서 확인한 뒤 결제 확인 또는 결제 취소로 정해요. 결제 확인 방식(웹훅 · 상태 조회)은 결제 대행사 연동 후 확정돼요 (TBD)."
    );
    expect(html).toMatch(/확인 필요 <span class="[^"]*warn[^"]*">1<\/span>/);
    expect(html).toContain("신용카드 · 10,000 FN · 11,000원");
    expect(html).toContain("확인 필요</span>");
    expect(html).toMatch(/href="\/members\/u-hongGD123"[^>]*>홍길동<\/a> · 요청 26\. 10\. 11\. 오후 2:23 · 거래번호 TXN-20261011-09124/);
    expect(html).toContain("결제 확인 전이라 FN은 아직 지급하지 않았어요.");
    expect(html).toContain('placeholder="처리 메모 (필수, 운영자만 봐요) · 예: 결제 대행사 관리자 화면 확인 결과"');
    expect(html).toContain('maxLength="200"');
    // Both outcomes wait for the memo.
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>결제 확인 \(FN 지급\)<\/button>/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>결제 취소 \(미지급\)<\/button>/);
    expect(html).not.toContain("미지급 · 탈퇴");
    expect(html).not.toContain("탈퇴한 회원의 충전이에요");
    expect(html).not.toContain("처리 완료");
  });

  it("warns that 결제 확인 credits nothing for a withdrawn member, on the card and on its button (2026-10-13)", async () => {
    const { PendingChargesScreen } = await import("./payments/PendingChargesScreen");
    const html = render(createElement(PendingChargesScreen, { view: { waiting: [pc({ memberId: "u-hongGD123-w1", memberWithdrawn: true })], resolved: [] } }));
    expect(html).toMatch(/>홍길동<\/a> <span class="[^"]*chipNeutral[^"]*">탈퇴<\/span>/);
    expect(html).toContain(
      "탈퇴한 회원의 충전이에요. 결제 확인으로 정해도 FN을 지급하지 않아요(탈퇴한 계정 규칙). 재가입한 새 계정에도 지급하지 않아요. 결제 금액의 처리(결제 취소 · 환불)는 정해지지 않았어요 (TBD)."
    );
    // The button does not promise FN: "결제 확인 (미지급 · 탈퇴)"; 결제 취소 is unchanged.
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>결제 확인 \(미지급 · 탈퇴\)<\/button>/);
    expect(html).not.toContain("결제 확인 (FN 지급)");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>결제 취소 \(미지급\)<\/button>/);
  });

  it("shows how each was decided under 처리 완료, without the form", async () => {
    const { PendingChargesScreen } = await import("./payments/PendingChargesScreen");
    const html = render(
      createElement(PendingChargesScreen, {
        view: {
          waiting: [],
          resolved: [
            pc({ chargeId: "ch-a", resolution: decided("COMPLETED", "CREDITED") }),
            pc({ chargeId: "ch-b", memberWithdrawn: true, resolution: decided("COMPLETED", "NOT_CREDITED") }),
            pc({ chargeId: "ch-c", resolution: decided("CANCELLED", "CANCELLED") })
          ]
        }
      })
    );
    expect(html).toContain("확인이 필요한 충전이 없어요.");
    expect(html).toContain("처리 완료 3");
    expect(html).toMatch(/chipOk[^"]*">완료 · FN 지급<\/span>/);
    expect(html).toMatch(/chipNeutral[^"]*">완료 · FN 미지급 \(탈퇴\)<\/span>/);
    expect(html).toMatch(/chipBad[^"]*">결제 취소<\/span>/);
    expect(html).toContain("26. 10. 12. 오후 3:00 · 운영자 · 결제 확인 · 10,000 FN을 회원에게 지급했어요");
    expect(html).toContain("운영자 · 결제 확인 · 탈퇴한 회원이라 10,000 FN을 지급하지 않았어요 (FN 미지급) · 결제 금액의 처리는 정해지지 않았어요 (TBD)");
    expect(html).toContain("운영자 · 결제 취소 · FN을 지급하지 않았어요");
    expect(html.match(/처리 메모: 결제 대행사 관리자 화면 확인/g)).toHaveLength(3);
    // The amount and transaction id the charge waited with stay on the decided card.
    expect(html.match(/신용카드 · 10,000 FN · 11,000원/g)).toHaveLength(3);
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain("결제 확인 (FN 지급)</button>");
  });

  it("calls a cancelled payment 결제 취소 in 결제 · 환불 › 충전 내역 too, as members see it (2026-10-13)", async () => {
    const { PaymentsScreen } = await import("./payments/PaymentScreens");
    const charge = { id: "ch1", chargedAt: "2026-10-11 14:23:05", methodLabel: "신용카드", fnAmount: 10_000, paidAmount: 0, status: "CANCELLED" as const, transactionId: null, refund: null };
    const html = render(
      createElement(PaymentsScreen, {
        view: { charges: [{ ...charge, memberId: "u-hongGD123", memberName: "홍길동", memberWithdrawn: false }], refunds: [], balance: 0, refundPolicy: { label: "기본값", summary: "요약" } },
        tab: "charges"
      })
    );
    expect(html).toContain("<td>결제 취소</td>");
  });

  it("shows the empty state", async () => {
    const { PendingChargesScreen } = await import("./payments/PendingChargesScreen");
    const html = render(createElement(PendingChargesScreen, { view: { waiting: [], resolved: [] } }));
    expect(html).toMatch(/확인 필요 0/);
    expect(html).toContain("확인이 필요한 충전이 없어요.");
    expect(html).not.toContain("처리 완료");
  });
});

describe("처리 중 충전 in the console", () => {
  it("adds the screen to the sidebar under 거래 and labels its audit entries", async () => {
    const { ADMIN_GROUPS, adminActiveHref, adminBreadcrumb } = await import("./AdminChrome");
    const items = ADMIN_GROUPS.find((g) => g.title === "거래")!.items;
    expect(items.map((i) => i.label)).toEqual(["후원 운영", "확인 중 후원", "결제 · 환불", "처리 중 충전", "정산 심사"]);
    expect(items.find((i) => i.label === "처리 중 충전")?.href).toBe("/payments/pending");
    expect(adminActiveHref("/payments/pending")).toBe("/payments/pending");
    expect(adminBreadcrumb("/payments/pending")).toBe("거래 / 처리 중 충전");
    expect(adminBreadcrumb("/payments")).toBe("거래 / 결제 · 환불");
    expect(AUDIT_ACTION_LABEL.PENDING_CHARGE_RESOLVE).toBe("처리 중 충전 결과 결정");
  });

  it("counts 처리 중 충전 in the dashboard's 처리 대기", async () => {
    const { AdminDashboardScreen } = await import("./AdminScreens");
    const data: AdminDashboard = {
      creators: { total: 1, live: 0 },
      charges: { monthCount: 0, monthFn: 0, monthPaidKrw: 0, processing: 1 },
      donations: { monthCount: 0, monthFn: 0 },
      pending: { refunds: 0, refundsBlocked: 0, refundsHeld: 0, settlements: 0, settlementsHeld: 0, reports: 0, platformDonations: 0, processingCharges: 1 },
      recentAudit: []
    };
    const html = render(createElement(AdminDashboardScreen, { data }));
    expect(html).toMatch(/<span>처리 중 충전<\/span><strong class="[^"]*warn[^"]*">1건<\/strong><span[^>]*>결제 대행사의 결제 확인이 오지 않은 충전 · 처리 중 충전에서 결정<\/span>/);
    // The tile beside the two 이번 달 tiles counts every 처리중 charge too, and says so (2026-10-13).
    expect(html).toMatch(/<span[^>]*>처리 중 충전<\/span><strong class="[^"]*tileValue[^"]*">1건<\/strong><span[^>]*>결제 확인 대기 · 전체 기간<\/span>/);
  });

  it("sends 결제 확인 / 결제 취소 to the site's resolve route with the memo and request id, and passes its answer on", async () => {
    site.send.mockResolvedValueOnce({ status: "OK", result: "NOT_CREDITED" });
    const { resolvePendingCharge } = await vi.importActual<typeof import("@/lib/actions")>("@/lib/actions");
    const input = { chargeId: "ch/1", outcome: "COMPLETED", note: "메모", requestId: "req-0000000000000001", extra: "dropped" };
    expect(await resolvePendingCharge(input)).toEqual({ status: "OK", result: "NOT_CREDITED" });
    expect(site.send).toHaveBeenCalledWith({ id: "adm-1", name: "운영자" }, "POST", "/pending-charges/ch%2F1/resolve", { outcome: "COMPLETED", note: "메모", requestId: "req-0000000000000001" });
  });
});
