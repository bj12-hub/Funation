import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CreatorSettingsScreen } from "@/features/creatorStudio/settings/CreatorSettingsScreen";
import { getT } from "@/lib/i18n/server";
import { getCreatorSettings } from "@/services/creator/creatorSettings";

// Figma: creator-account-settings-page 315:405 · 315:2 · 프로필 수정 326:496
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("studioSettings.meta") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  const settings = await getCreatorSettings();
  if (!settings) redirect("/login?role=creator&next=/creator/settings");
  return <CreatorSettingsScreen settings={settings} />;
}
