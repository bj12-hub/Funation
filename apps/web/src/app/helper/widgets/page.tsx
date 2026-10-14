import type { Metadata } from "next";
import { WidgetSettingsScreen } from "@/features/creatorStudio/widgets/WidgetSettingsScreen";
import { getOverlaySwitches } from "@/services/creator/alertRemote";
import { getCreatorSettings } from "@/services/creator/creatorSettings";
import { getOverlayAppearance } from "@/services/creator/overlayTheme";

// The studio 위젯 catalog (Figma 529:4 + popups), on the helper domain.
export const metadata: Metadata = { title: "위젯" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [settings, switches, appearance] = await Promise.all([getCreatorSettings(), getOverlaySwitches(), getOverlayAppearance()]);
  if (!settings || !switches || !appearance) return null;
  return <WidgetSettingsScreen alertWidgetUrl={settings.alertWidgetUrl} switches={switches} appearance={appearance} />;
}
