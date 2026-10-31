import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CreatorSettingsScreen } from "@/features/creatorStudio/settings/CreatorSettingsScreen";
import { FlextvChannelSettingsScreen } from "@/features/creatorStudio/settings/FlextvChannelSettingsScreen";
import { FLEXTV_SITE } from "@/lib/flextv/mode";
import { getT } from "@/lib/i18n/server";
import { getCreatorSettings } from "@/services/creator/creatorSettings";
import { getFlextvChannelSettings } from "@/services/creator/flextvChannelSettings";

// Figma: creator-account-settings-page 315:405 · 315:2 · 프로필 수정 326:496
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())(FLEXTV_SITE ? "studioSettings.metaChannel" : "studioSettings.meta") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  // With FLEXTV (phase 7): the streamer's FLEXTV 방송국.
  if (FLEXTV_SITE) {
    const view = await getFlextvChannelSettings();
    if (!view) redirect("/login?role=creator&next=/creator/settings");
    return <FlextvChannelSettingsScreen view={view} />;
  }
  const settings = await getCreatorSettings();
  if (!settings) redirect("/login?role=creator&next=/creator/settings");
  return <CreatorSettingsScreen settings={settings} />;
}
