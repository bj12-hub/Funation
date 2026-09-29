import { HomeScreen } from "@/features/home";
import { getHomeFeed } from "@/services/home/homeFeed";
import { getAllLiveChannels, getPopularLiveSections } from "@/services/live/liveChannels";

// Home — section order follows funnation (see HomeScreen); visuals from Figma funation-videos-page 727:2742.
// Rendered per request so the feed (live counts) is never served stale from the build.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [feed, liveSections, liveChannels] = await Promise.all([getHomeFeed(), getPopularLiveSections(), getAllLiveChannels()]);
  return <HomeScreen feed={feed} liveSections={liveSections} liveChannels={liveChannels} />;
}
