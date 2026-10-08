import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VideoListScreen } from "@/features/creatorStudio/youtube/YouTubeScreens";
import { getYouTubeIntegration, listManagedVideos } from "@/services/creator/youtube";

// Code-first (no Figma frame): 영상 목록 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "영상 목록 | Ssumnation 크리에이터" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [integration, videos] = await Promise.all([getYouTubeIntegration(), listManagedVideos()]);
  if (!integration || !videos) redirect("/login?role=creator&next=/creator/videos");
  return <VideoListScreen integration={integration} videos={videos} />;
}
