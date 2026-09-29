import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CreatorSettingsScreen } from "@/features/creatorStudio/settings/CreatorSettingsScreen";
import { getCreatorSettings } from "@/services/creator/creatorSettings";

// Figma: creator-account-settings-page 315:405 · 315:2 · 프로필 수정 326:496
export const metadata: Metadata = { title: "계정설정 | Funation 크리에이터" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const settings = await getCreatorSettings();
  if (!settings) redirect("/login?role=creator&next=/creator/settings");
  return <CreatorSettingsScreen settings={settings} />;
}
