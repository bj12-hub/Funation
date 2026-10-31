import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SettlementHomeScreen } from "@/features/creatorStudio/settlement/SettlementHomeScreen";
import { FlextvSettlementHome } from "@/features/creatorStudio/settlement/FlextvSettlementScreens";
import { FLEXTV_STUDIO } from "@/lib/flextv/mode";
import { getFlextvSettlementView } from "@/services/creator/flextvSettlement";
import { getT } from "@/lib/i18n/server";
import { getSettlementOverview } from "@/services/creator/settlement";

// Figma: settlement-management 429:4 · 정산 자료 등록 필요 433:4 · 이미 등록 462:2 · 본인인증 필요 (code-first)
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("studioSettlement.metaHome") };
}
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ registered?: string; gate?: string }> }) {
  if (FLEXTV_STUDIO) {
    // 정산 = FLEXTV's 환전 (phase 5).
    const view = await getFlextvSettlementView();
    if (!view) redirect("/login?role=creator&next=/creator/settlement");
    return <FlextvSettlementHome view={view} />;
  }
  const [overview, { registered, gate }] = await Promise.all([getSettlementOverview(), searchParams]);
  if (!overview) redirect("/login?role=creator&next=/creator/settlement");
  // `gate=identity` comes from the apply page; it only opens the notice while 본인인증 is still missing.
  const identityGate = gate === "identity" && overview.registered && !overview.checklist.identityVerified;
  return (
    <SettlementHomeScreen
      registered={overview.registered}
      justRegistered={overview.registered && registered === "1"}
      checklist={overview.checklist}
      minFn={overview.minFn}
      identityGate={identityGate}
    />
  );
}
