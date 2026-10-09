import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PaymentsView } from "@/types/adminApi";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock("@/lib/actions", () => ({}));

/**
 * 2026-10-10 결정: a charge whose payment completed after the member withdrew is credited to nobody; 결제 · 환불 shows it
 * as 완료 · FN 미지급 (탈퇴), with a note that what happens to the KRW is TBD.
 */
const row = { chargedAt: "2026-10-10 10:00:00", methodLabel: "카카오페이", fnAmount: 10_000, paidAmount: 11_000, status: "COMPLETED" as const, transactionId: "TXN-1", refund: null };
const view = (charges: PaymentsView["charges"]): PaymentsView => ({ charges, refunds: [], balance: 0, refundPolicy: { label: "기본값", summary: "요약" } });

describe("충전 내역 · FN 미지급 (탈퇴)", () => {
  it("marks a charge paid after the member withdrew and explains it once", async () => {
    const { PaymentsScreen } = await import("./payments/PaymentScreens");
    const html = renderToStaticMarkup(
      createElement(PaymentsScreen, {
        view: view([
          { ...row, id: "ch-late", memberId: "u-hongGD123-w1", memberName: "홍길동", memberWithdrawn: true, fnNotCredited: true },
          { ...row, id: "ch-ok", transactionId: "TXN-2", memberId: "u-hongGD123", memberName: "다시왔어요", memberWithdrawn: false, fnNotCredited: false }
        ]),
        tab: "charges"
      })
    );
    expect(html.match(/완료<span class="[^"]*warn[^"]*"> · FN 미지급 \(탈퇴\)<\/span>/g)).toHaveLength(1);
    expect(html).toContain("FN 미지급 (탈퇴): 결제가 끝나기 전에 회원이 탈퇴해 FN을 지급하지 않은 충전이에요.");
  });

  it("shows no note when every charge was credited (also from a site without the field)", async () => {
    const { PaymentsScreen } = await import("./payments/PaymentScreens");
    const html = renderToStaticMarkup(createElement(PaymentsScreen, { view: view([{ ...row, id: "ch-ok", memberId: "u-hongGD123", memberName: "홍길동", memberWithdrawn: false }]), tab: "charges" }));
    expect(html).not.toContain("FN 미지급");
  });
});
