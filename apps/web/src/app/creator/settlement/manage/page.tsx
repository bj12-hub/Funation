import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SettlementManageScreen } from "@/features/creatorStudio/settlement/SettlementManageScreen";
import { getSettlementManageView } from "@/services/creator/settlementManagement";

// Figma: 정산 관리 478:2 (월별) · 479:144 (기간별) · 정산 정보 변경 480:2
export const metadata: Metadata = { title: "정산 관리 | Somnation 크리에이터" };
export const dynamic = "force-dynamic";

type Search = { period?: string; from?: string; to?: string; page?: string };

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const view = await getSettlementManageView(await searchParams);
  if (view === "UNAUTHORIZED") redirect("/login?role=creator&next=/creator/settlement/manage");
  if (view === "NOT_REGISTERED") redirect("/creator/settlement");
  return <SettlementManageScreen view={view} />;
}
