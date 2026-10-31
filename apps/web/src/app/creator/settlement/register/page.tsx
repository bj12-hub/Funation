import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SettlementTermsScreen } from "@/features/creatorStudio/settlement/SettlementTermsScreen";
import { FlextvAccountScreen } from "@/features/creatorStudio/settlement/FlextvSettlementScreens";
import { FLEXTV_STUDIO } from "@/lib/flextv/mode";
import { getFlextvSettlementView } from "@/services/creator/flextvSettlement";
import { getSettlementOverview } from "@/services/creator/settlement";
import { isMemberType } from "@/services/creator/settlementTypes";

// Figma: 이용동의 429:139 · 443:257 · 433:138 · 437:338 · 대한민국 이외 452:4 · 452:47
export const metadata: Metadata = { title: FLEXTV_STUDIO ? "정산 계좌 | Ssumnation 크리에이터" : "정산 등록 | Ssumnation 크리에이터" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  if (FLEXTV_STUDIO) {
    // The 환전 계좌 is registered and reviewed on FLEXTV's site (phase 5).
    const view = await getFlextvSettlementView();
    if (!view) redirect("/login?role=creator&next=/creator/settlement/register");
    return <FlextvAccountScreen view={view} />;
  }
  const [overview, { type }] = await Promise.all([getSettlementOverview(), searchParams]);
  if (!overview) redirect("/login?role=creator&next=/creator/settlement/register");
  // Re-registration starts from 정산 관리 > 정보 변경 (480:2), which clears the current data first.
  if (overview.registered) redirect("/creator/settlement/manage");
  return <SettlementTermsScreen initialType={isMemberType(type) ? type : "INDIVIDUAL"} />;
}
