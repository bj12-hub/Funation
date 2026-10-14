import type { Metadata } from "next";
import { BroadcastScreen } from "@/features/creatorStudio/crew/BroadcastScreen";
import { getOverlaySwitches } from "@/services/creator/alertRemote";
import { getBroadcastView } from "@/services/crew/crewBroadcast";

// Code-first (no Figma frame): 크루 방송 운영, on the helper domain — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "크루 방송 운영" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [view, switches] = await Promise.all([getBroadcastView(), getOverlaySwitches()]);
  if (!view || !switches) return null;
  return <BroadcastScreen view={view} switches={switches} />;
}
