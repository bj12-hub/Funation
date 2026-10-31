import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BroadcastScreen } from "@/features/creatorStudio/crew/BroadcastScreen";
import { getT } from "@/lib/i18n/server";
import { getOverlaySwitches } from "@/services/creator/alertRemote";
import { getBroadcastView } from "@/services/crew/crewBroadcast";

// Code-first (no Figma frame): 크루 방송 운영 — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("crewOps.metaBroadcast") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  const [view, switches] = await Promise.all([getBroadcastView(), getOverlaySwitches()]);
  if (!view || !switches) redirect("/login?role=creator&next=/creator/crew/broadcast");
  return <BroadcastScreen view={view} switches={switches} />;
}
