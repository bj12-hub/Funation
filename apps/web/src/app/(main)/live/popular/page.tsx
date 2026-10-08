import type { Metadata } from "next";
import { PopularLiveScreen } from "@/features/live";
import { getPopularLiveChannels } from "@/services/live/liveChannels";

// Figma: funnation-popular-live-page 617:5 (인기라이브), without the category sections
export const metadata: Metadata = { title: "인기 라이브 | Ssumnation" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const channels = await getPopularLiveChannels();
  return <PopularLiveScreen channels={channels} />;
}
