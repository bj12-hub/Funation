import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { WidgetSettingsScreen } from "@/features/creatorStudio/widgets/WidgetSettingsScreen";
import { FLEXTV_SSUMNATION_API, FLEXTV_STUDIO } from "@/lib/flextv/mode";
import { getOverlaySwitches } from "@/services/creator/alertRemote";
import { OVERLAY_TARGETS, type OverlayTarget } from "@/services/creator/alertTypes";
import { getCreatorSettings } from "@/services/creator/creatorSettings";
import { isDesignWidget } from "@/services/creator/flextvOverlayDesign";
import { getOverlayAppearance } from "@/services/creator/overlayTheme";
import { isEditableWidget } from "@/services/creator/widgetSettingsTypes";

// Figma: donation-widget-notification-settings 529:4 · popups 364:6 (채팅창) · 364:158 (QR) · 364:265 (후원목표) · 372:7 (후원누적금액)
export const metadata: Metadata = { title: "위젯 | Ssumnation 크리에이터" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** With FLEXTV the 리모컨's 기능 제어 switches are not there: every overlay it runs is on. */
const ALL_ON = Object.fromEntries(OVERLAY_TARGETS.map((t) => [t.key, true])) as Record<OverlayTarget, boolean>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  // With FLEXTV (phase 8): the theme and the look of the overlays FLEXTV runs, with its Ssumnation endpoints only.
  if (FLEXTV_STUDIO) {
    if (!FLEXTV_SSUMNATION_API) notFound();
    const [appearance, raw] = await Promise.all([getOverlayAppearance(), searchParams]);
    if (!appearance) redirect("/login?role=creator&next=/creator/widgets");
    return <WidgetSettingsScreen flextv alertWidgetUrl="" switches={ALL_ON} appearance={appearance} initialOpen={isDesignWidget(raw.open) ? raw.open : null} />;
  }
  const [settings, switches, appearance, raw] = await Promise.all([getCreatorSettings(), getOverlaySwitches(), getOverlayAppearance(), searchParams]);
  if (!settings || !switches || !appearance) redirect("/login?role=creator&next=/creator/widgets");
  // `?open=GOAL` (links from 오버레이 주소, 리모컨, 대시보드) opens that widget's popup.
  const open = isEditableWidget(raw.open) ? raw.open : null;
  return <WidgetSettingsScreen alertWidgetUrl={settings.alertWidgetUrl} switches={switches} appearance={appearance} initialOpen={open} />;
}
