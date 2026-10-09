import type { Metadata } from "next";
import { PendingDonationsScreen } from "@/features/payments/PendingDonationsScreen";
import { loadPendingDonations } from "@/lib/queries";

export const metadata: Metadata = { title: "확인 중 후원 | Ssumnation 관리자" };
export const dynamic = "force-dynamic";

/** 확인 중 후원 (2026-10-08 결정): reading it makes the site re-check the PENDING platform donations still inside their 24 h. */
export default async function Page() {
  const view = await loadPendingDonations();
  if (!view) throw new Error("확인 중 후원을 불러오지 못했어요.");
  return <PendingDonationsScreen view={view} />;
}
