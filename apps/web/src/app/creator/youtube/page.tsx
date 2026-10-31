import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { YouTubeConnectScreen } from "@/features/creatorStudio/youtube/YouTubeScreens";
import { getT } from "@/lib/i18n/server";
import { getYouTubeIntegration } from "@/services/creator/youtube";

// Code-first (no Figma frame): 유튜브 연동 — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("studioYoutube.meta") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  const integration = await getYouTubeIntegration();
  if (!integration) redirect("/login?role=creator&next=/creator/youtube");
  return <YouTubeConnectScreen integration={integration} />;
}
