import type { Metadata } from "next";
import { PopularLiveScreen } from "@/features/live";
import { getT } from "@/lib/i18n/server";
import { getPopularLiveChannels } from "@/services/live/liveChannels";

// Figma: funnation-popular-live-page 617:5 (인기라이브), without the category sections
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("live.metaPopular") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  const channels = await getPopularLiveChannels();
  return <PopularLiveScreen channels={channels} />;
}
