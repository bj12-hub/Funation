import type { Metadata } from "next";
import { OverlayUrlsScreen } from "@/features/creatorStudio/widgets/OverlayUrlsScreen";
import { getOverlaySwitches } from "@/services/creator/alertRemote";
import { getOverlayKey } from "@/services/creator/broadcastTools";
import { getOverlayAppearance } from "@/services/creator/overlayTheme";
import { getT } from "@/lib/i18n/server";

// Code-first (no Figma frame): 오버레이 주소, on the helper domain — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("helperNav.overlays") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  const [key, switches, appearance] = await Promise.all([getOverlayKey(), getOverlaySwitches(), getOverlayAppearance()]);
  if (!key || !switches || !appearance) return null;
  return <OverlayUrlsScreen overlayKey={key} switches={switches} appearance={appearance} />;
}
