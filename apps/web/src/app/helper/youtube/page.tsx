import type { Metadata } from "next";
import { YouTubeConnectScreen } from "@/features/creatorStudio/youtube/YouTubeScreens";
import { getYouTubeIntegration } from "@/services/creator/youtube";

// Code-first (no Figma frame): 유튜브 연동 (채팅 · 슈퍼챗 연결), on the helper domain — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "유튜브 연동" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const integration = await getYouTubeIntegration();
  if (!integration) return null;
  return <YouTubeConnectScreen integration={integration} />;
}
