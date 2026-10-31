import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OverlayUrlsScreen } from "@/features/creatorStudio/widgets/OverlayUrlsScreen";
import { getT } from "@/lib/i18n/server";
import { getOverlaySwitches } from "@/services/creator/alertRemote";
import { getOverlayKey } from "@/services/creator/broadcastTools";
import { getOverlayAppearance } from "@/services/creator/overlayTheme";

// Code-first (no Figma frame): 오버레이 주소 — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("studioToolsOverlays.meta") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  const [key, switches, appearance] = await Promise.all([getOverlayKey(), getOverlaySwitches(), getOverlayAppearance()]);
  if (!key || !switches || !appearance) redirect("/login?role=creator&next=/creator/widgets/overlays");
  return <OverlayUrlsScreen overlayKey={key} switches={switches} appearance={appearance} />;
}
