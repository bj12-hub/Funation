import { HomeScreen } from "@/features/home";
import { getHomeFeed } from "@/services/home/homeFeed";

// Figma: funation-videos-page 727:2742
// Rendered per request so the feed (live counts, ranking) is never served stale from the build.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const feed = await getHomeFeed();
  return <HomeScreen feed={feed} />;
}
