import type { Metadata } from "next";
import { BannerScreen } from "@/features/creatorStudio/widgets/library/BannerScreen";
import { getOverlaySwitches } from "@/services/creator/alertRemote";
import { listAssets } from "@/services/creator/assets";
import { getBannerSettings } from "@/services/creator/banner";
import { getOverlayKey } from "@/services/creator/broadcastTools";
import { getT } from "@/lib/i18n/server";

// Code-first (no Figma frame): 배너 위젯, on the helper domain — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("helperNav.banner") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  const [settings, library, key, switches] = await Promise.all([getBannerSettings(), listAssets("IMAGE"), getOverlayKey(), getOverlaySwitches()]);
  if (!settings || !library || !key || !switches) return null;
  return <BannerScreen initial={settings} library={library} overlayPath={`/overlay/banner/${key}`} switches={switches} />;
}
