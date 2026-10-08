import type { Metadata } from "next";
import { SettlementReviewScreen } from "@/features/settlements/SettlementReviewScreen";
import { loadSettlements } from "@/lib/queries";
import { SETTLEMENT_STATUSES, type SettlementStatus } from "@/types/adminApi";

export const metadata: Metadata = { title: "정산 심사 | Ssumnation 관리자" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const raw = (await searchParams).status;
  const status = SETTLEMENT_STATUSES.includes(raw as SettlementStatus) ? (raw as SettlementStatus) : null;
  const view = await loadSettlements(status);
  if (!view) throw new Error("정산 신청을 불러오지 못했어요.");
  return <SettlementReviewScreen view={view} status={status} />;
}
