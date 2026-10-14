import type { Metadata } from "next";
import { OverlayUrlsScreen } from "@/features/creatorStudio/widgets/OverlayUrlsScreen";
import { getOverlaySwitches } from "@/services/creator/alertRemote";
import { getOverlayKey } from "@/services/creator/broadcastTools";
import { getOverlayAppearance } from "@/services/creator/overlayTheme";

// Code-first (no Figma frame): 오버레이 주소, on the helper domain — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "오버레이 주소" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [key, switches, appearance] = await Promise.all([getOverlayKey(), getOverlaySwitches(), getOverlayAppearance()]);
  if (!key || !switches || !appearance) return null;
  return <OverlayUrlsScreen overlayKey={key} switches={switches} appearance={appearance} />;
}
