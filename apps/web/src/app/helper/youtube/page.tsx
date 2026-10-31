import type { Metadata } from "next";
import { YouTubeConnectScreen } from "@/features/creatorStudio/youtube/YouTubeScreens";
import { getYouTubeIntegration } from "@/services/creator/youtube";
import { getT } from "@/lib/i18n/server";

// Code-first (no Figma frame): 유튜브 연동 (채팅 · 슈퍼챗 연결), on the helper domain — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("helperNav.youtube") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  const integration = await getYouTubeIntegration();
  if (!integration) return null;
  return <YouTubeConnectScreen integration={integration} />;
}
