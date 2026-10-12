import type { Metadata } from "next";
import { PendingChargesScreen } from "@/features/payments/PendingChargesScreen";
import { loadPendingCharges } from "@/lib/queries";

export const metadata: Metadata = { title: "처리 중 충전 | Ssumnation 관리자" };
export const dynamic = "force-dynamic";

/** 처리 중 충전 (2026-10-12 결정): FN 충전 still 처리중, decided here as 결제 확인 or 결제 취소. */
export default async function Page() {
  const view = await loadPendingCharges();
  if (!view) throw new Error("처리 중 충전을 불러오지 못했어요.");
  return <PendingChargesScreen view={view} />;
}
