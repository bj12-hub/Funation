import type { Metadata } from "next";
import { BroadcastToolsScreen } from "@/features/creatorStudio/widgets/BroadcastToolsScreen";
import { getOverlaySwitches } from "@/services/creator/alertRemote";
import { getOverlayKey, getToolsView } from "@/services/creator/broadcastTools";
import { getT } from "@/lib/i18n/server";

// Code-first (no Figma frame): 방송 도구, on the helper domain — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("helperNav.tools") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  const [view, key, switches] = await Promise.all([getToolsView(), getOverlayKey(), getOverlaySwitches()]);
  if (!view || !key || !switches) return null;
  return <BroadcastToolsScreen view={view} overlayKey={key} switches={switches} />;
}
