import type { NextRequest } from "next/server";
import { csvResponse, toCsv } from "@/lib/csv";
import { parseHistoryParams } from "@/features/wallet/historyParams";
import { CHARGE_STATUS_LABEL, REFUND_STATUS_LABEL, getChargeHistory } from "@/services/wallet/walletHistory";

/** CSV 다운로드 for `/wallet/charges` (Figma 640:2). Same filters as the page; session required. */
export async function GET(request: NextRequest) {
  const { period } = parseHistoryParams(Object.fromEntries(request.nextUrl.searchParams));
  const data = await getChargeHistory({ period, all: true });
  if (!data) return new Response("Unauthorized", { status: 401 });

  // 환불 상태 follows the table's tag (환불 요청 · 환불 완료 · 환불 거절); 처리 상태 stays the charge's own status.
  const csv = toCsv(
    ["날짜와 시간", "결제수단", "충전 FN", "결제 금액(원)", "처리 상태", "환불 상태", "거래 번호"],
    data.items.map((c) => [c.chargedAt, c.methodLabel, c.fnAmount, c.paidAmount, CHARGE_STATUS_LABEL[c.status], c.refund ? REFUND_STATUS_LABEL[c.refund.status] : "-", c.transactionId ?? "-"])
  );
  return csvResponse(csv, `fn-charges_${period.from}_${period.to}.csv`);
}
