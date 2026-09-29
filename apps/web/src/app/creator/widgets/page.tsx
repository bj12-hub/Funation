import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WidgetSettingsScreen } from "@/features/creatorStudio/widgets/WidgetSettingsScreen";
import { getCreatorSettings } from "@/services/creator/creatorSettings";

// Figma: donation-widget-notification-settings 529:4 · popups 364:6 (채팅창) · 364:158 (QR) · 364:265 (후원목표) · 372:7 (후원누적금액)
export const metadata: Metadata = { title: "위젯 | Somnation 크리에이터" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const settings = await getCreatorSettings();
  if (!settings) redirect("/login?role=creator&next=/creator/widgets");
  return <WidgetSettingsScreen alertWidgetUrl={settings.alertWidgetUrl} />;
}
