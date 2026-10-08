import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BannerScreen } from "@/features/creatorStudio/widgets/library/BannerScreen";
import { getOverlaySwitches } from "@/services/creator/alertRemote";
import { listAssets } from "@/services/creator/assets";
import { getBannerSettings } from "@/services/creator/banner";
import { getOverlayKey } from "@/services/creator/broadcastTools";

// Code-first (no Figma frame): 배너 위젯 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "배너 | Somnation 크리에이터" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [settings, library, key, switches] = await Promise.all([getBannerSettings(), listAssets("IMAGE"), getOverlayKey(), getOverlaySwitches()]);
  if (!settings || !library || !key || !switches) redirect("/login?role=creator&next=/creator/widgets/banner");
  return <BannerScreen initial={settings} library={library} overlayPath={`/overlay/banner/${key}`} switches={switches} />;
}
