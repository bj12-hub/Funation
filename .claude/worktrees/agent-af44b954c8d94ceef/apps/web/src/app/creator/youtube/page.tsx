import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { YouTubeConnectScreen } from "@/features/creatorStudio/youtube/YouTubeScreens";
import { getYouTubeIntegration } from "@/services/creator/youtube";

// Code-first (no Figma frame): 유튜브 연동 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "유튜브 연동 | Somnation 크리에이터" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const integration = await getYouTubeIntegration();
  if (!integration) redirect("/login?role=creator&next=/creator/youtube");
  return <YouTubeConnectScreen integration={integration} />;
}
