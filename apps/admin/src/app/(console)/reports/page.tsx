import type { Metadata } from "next";
import { ReportsScreen } from "@/features/reports/ReportsScreen";
import { loadReports } from "@/lib/queries";
import { REPORT_STATUSES, type ReportStatus } from "@/types/adminApi";

export const metadata: Metadata = { title: "신고 처리 | Ssumnation 관리자" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const raw = (await searchParams).status;
  const status: ReportStatus = REPORT_STATUSES.includes(raw as ReportStatus) ? (raw as ReportStatus) : "OPEN";
  const view = await loadReports(status);
  if (!view) throw new Error("신고 목록을 불러오지 못했어요.");
  return <ReportsScreen view={view} status={status} />;
}
