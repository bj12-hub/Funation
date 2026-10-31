import type { Metadata } from "next";
import { BroadcastScreen } from "@/features/creatorStudio/crew/BroadcastScreen";
import { getOverlaySwitches } from "@/services/creator/alertRemote";
import { getBroadcastView } from "@/services/crew/crewBroadcast";
import { getT } from "@/lib/i18n/server";

// Code-first (no Figma frame): 크루 방송 운영, on the helper domain — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("helper.metaCrewBroadcast") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  const [view, switches] = await Promise.all([getBroadcastView(), getOverlaySwitches()]);
  if (!view || !switches) return null;
  return <BroadcastScreen view={view} switches={switches} />;
}
