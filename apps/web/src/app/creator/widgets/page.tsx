import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WidgetSettingsScreen } from "@/features/creatorStudio/widgets/WidgetSettingsScreen";
import { getOverlaySwitches } from "@/services/creator/alertRemote";
import { getCreatorSettings } from "@/services/creator/creatorSettings";
import { getOverlayAppearance } from "@/services/creator/overlayTheme";
import { isEditableWidget } from "@/services/creator/widgetSettingsTypes";

// Figma: donation-widget-notification-settings 529:4 · popups 364:6 (채팅창) · 364:158 (QR) · 364:265 (후원목표) · 372:7 (후원누적금액)
export const metadata: Metadata = { title: "위젯 | Ssumnation 크리에이터" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const [settings, switches, appearance, raw] = await Promise.all([getCreatorSettings(), getOverlaySwitches(), getOverlayAppearance(), searchParams]);
  if (!settings || !switches || !appearance) redirect("/login?role=creator&next=/creator/widgets");
  // `?open=GOAL` (links from 오버레이 주소, 리모컨, 대시보드) opens that widget's popup.
  const open = isEditableWidget(raw.open) ? raw.open : null;
  return <WidgetSettingsScreen alertWidgetUrl={settings.alertWidgetUrl} switches={switches} appearance={appearance} initialOpen={open} />;
}
