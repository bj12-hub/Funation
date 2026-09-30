import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SettlementReviewScreen } from "@/features/admin/settlements/SettlementReviewScreen";
import { getSettlementReview } from "@/services/admin/settlements";
import type { SettlementStatus } from "@/services/creator/settlementTypes";

// Code-first (no Figma frame): 정산 심사 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "정산 심사 | Somnation 관리자", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const STATUSES: SettlementStatus[] = ["PENDING", "APPROVED", "REJECTED"];

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const raw = (await searchParams).status;
  const status = STATUSES.includes(raw as SettlementStatus) ? (raw as SettlementStatus) : null;
  const view = await getSettlementReview({ status });
  if (!view) redirect("/admin/login");
  return <SettlementReviewScreen view={view} status={status} />;
}
