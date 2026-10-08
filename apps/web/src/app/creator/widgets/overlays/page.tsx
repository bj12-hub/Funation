import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OverlayUrlsScreen } from "@/features/creatorStudio/widgets/OverlayUrlsScreen";
import { getOverlaySwitches } from "@/services/creator/alertRemote";
import { getOverlayKey } from "@/services/creator/broadcastTools";

// Code-first (no Figma frame): 오버레이 주소 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "오버레이 주소 | Ssumnation 크리에이터" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [key, switches] = await Promise.all([getOverlayKey(), getOverlaySwitches()]);
  if (!key || !switches) redirect("/login?role=creator&next=/creator/widgets/overlays");
  return <OverlayUrlsScreen overlayKey={key} switches={switches} />;
}
