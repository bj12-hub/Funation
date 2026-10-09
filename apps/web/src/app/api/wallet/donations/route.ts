import type { NextRequest } from "next/server";
import { csvResponse, toCsv } from "@/lib/csv";
import { parseDonationFilter, parseHistoryParams } from "@/features/wallet/historyParams";
import { donationStatusLabel, getDonationHistory } from "@/services/wallet/walletHistory";

/** CSV 다운로드 for `/wallet/donations` (Figma 632:4). Same filters as the page; session required. */
export async function GET(request: NextRequest) {
  const raw = Object.fromEntries(request.nextUrl.searchParams);
  const { period, category } = parseHistoryParams(raw);
  const data = await getDonationHistory({ period, category, all: true, filter: parseDonationFilter(raw) });
  if (!data) return new Response("Unauthorized", { status: 401 });

  const csv = toCsv(
    ["날짜와 시간", "크리에이터", "후원 내용", "사용 FN 금액", "후원 유형", "처리 상태"],
    data.items.map((d) => [d.donatedAt, d.creatorName, d.message, d.fnAmount, d.typeLabel, donationStatusLabel(d)])
  );
  return csvResponse(csv, `fn-donations_${category}_${period.from}_${period.to}.csv`);
}
