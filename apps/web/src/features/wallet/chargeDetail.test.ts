import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ChargeRecord } from "@/services/wallet/walletTypes";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {}, push() {} }) }));
vi.mock("@/services/wallet/refund", () => ({ quoteChargeRefund: vi.fn(), requestChargeRefund: vi.fn() }));

/**
 * `/wallet/charges` 충전내역 상세정보 — 결제 확인 일시 (code-first, 2026-10-13): right under 충전 일시, in the same format,
 * only when the server gives one (a 처리중 charge confirmed later: its 7-day 청약철회 period counts from there).
 */
const completed: ChargeRecord = {
  id: "ch1",
  chargedAt: "2026-10-11 14:23:05",
  methodEmoji: "💳",
  methodLabel: "신용카드",
  methodDetail: "일시불",
  fnAmount: 10_000,
  paidAmount: 11_000,
  status: "COMPLETED",
  transactionId: "TXN-20261011-09124"
};
const cancelled: ChargeRecord = { ...completed, paidAmount: 0, status: "CANCELLED", transactionId: null };

async function render(charge: ChargeRecord) {
  const { ChargeDetail } = await import("./ChargeTable");
  return renderToStaticMarkup(createElement(ChargeDetail, { charge }));
}

const terms = (html: string) => [...html.matchAll(/<dt>(.*?)<\/dt>/g)].map((m) => m[1]);
const valueOf = (html: string, term: string) => html.match(new RegExp(`<dt>${term}</dt><dd[^>]*>(.*?)</dd>`))?.[1] ?? null;

describe("충전내역 상세정보 · 결제 확인 일시", () => {
  it("shows the 결제 확인 일시 of a charge confirmed later right under 충전 일시, in the same format", async () => {
    const html = await render({ ...completed, confirmedAt: "2026-10-14 09:30:05" });
    expect(terms(html)).toEqual(["충전 일시", "결제 확인 일시", "결제 수단", "결제 금액", "거래 번호 (TID)"]);
    expect(valueOf(html, "충전 일시")).toBe("2026-10-11 14:23:05");
    expect(valueOf(html, "결제 확인 일시")).toBe("2026-10-14 09:30:05");
  });

  it("shows it in Korea time whatever zone the value names", async () => {
    // 2026-10-14 00:30:05 UTC is 09:30:05 in Korea.
    expect(valueOf(await render({ ...completed, confirmedAt: "2026-10-14T00:30:05.000Z" }), "결제 확인 일시")).toBe("2026-10-14 09:30:05");
  });

  it("has no such row for a charge paid with its request", async () => {
    const html = await render(completed);
    expect(terms(html)).toEqual(["충전 일시", "결제 수단", "결제 금액", "거래 번호 (TID)"]);
    expect(html).not.toContain("결제 확인 일시");
  });

  it("has no such row for a 결제 취소", async () => {
    const html = await render(cancelled);
    expect(terms(html)).toEqual(["충전 일시", "결제 수단", "결제 금액", "거래 번호 (TID)"]);
    expect(html).not.toContain("결제 확인 일시");
  });
});
