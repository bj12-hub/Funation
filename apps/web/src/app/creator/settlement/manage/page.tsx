import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SettlementManageScreen } from "@/features/creatorStudio/settlement/SettlementManageScreen";
import { FlextvManageScreen } from "@/features/creatorStudio/settlement/FlextvSettlementScreens";
import { FLEXTV_STUDIO } from "@/lib/flextv/mode";
import { getExchangeHistory } from "@/services/creator/flextvSettlement";
import { getT } from "@/lib/i18n/server";
import { getSettlementManageView } from "@/services/creator/settlementManagement";

// Figma: 정산 관리 478:2 (월별) · 479:144 (기간별) · 정산 정보 변경 480:2
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("studioSettlement.metaManage") };
}
export const dynamic = "force-dynamic";

type Search = { period?: string; from?: string; to?: string; page?: string };

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  if (FLEXTV_STUDIO) {
    const history = await getExchangeHistory(await searchParams);
    if (!history) redirect("/login?role=creator&next=/creator/settlement/manage");
    return <FlextvManageScreen view={history} />;
  }
  const view = await getSettlementManageView(await searchParams);
  if (view === "UNAUTHORIZED") redirect("/login?role=creator&next=/creator/settlement/manage");
  if (view === "NOT_REGISTERED") redirect("/creator/settlement");
  return <SettlementManageScreen view={view} />;
}
