import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SettlementApplyScreen } from "@/features/creatorStudio/settlement/SettlementApplyScreen";
import { FlextvApplyScreen } from "@/features/creatorStudio/settlement/FlextvSettlementScreens";
import { FLEXTV_STUDIO } from "@/lib/flextv/mode";
import { getFlextvSettlementView } from "@/services/creator/flextvSettlement";
import { getT } from "@/lib/i18n/server";
import { getSettlementApplyView } from "@/services/creator/settlementRequests";

// Figma: 정산 신청 458:4 · 463:2 — popups 466:2 · 469:195 · 469:2 · 475:2 · 473:2 · 477:2
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("studioSettlement.metaApply") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  if (FLEXTV_STUDIO) {
    const flextv = await getFlextvSettlementView();
    if (!flextv) redirect("/login?role=creator&next=/creator/settlement/apply");
    return <FlextvApplyScreen view={flextv} />;
  }
  const view = await getSettlementApplyView();
  if (view === "UNAUTHORIZED") redirect("/login?role=creator&next=/creator/settlement/apply");
  // Requesting needs a registration first; the settlement home explains that (433:4).
  if (view === "NOT_REGISTERED") redirect("/creator/settlement");
  // 2026-10-06 결정: requesting also needs 본인인증; the settlement home opens that notice.
  if (view === "IDENTITY_REQUIRED") redirect("/creator/settlement?gate=identity");
  return <SettlementApplyScreen view={view} />;
}
