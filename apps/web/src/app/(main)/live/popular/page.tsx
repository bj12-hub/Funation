import type { Metadata } from "next";
import { PopularLiveScreen } from "@/features/live";
import { getPopularLiveSections } from "@/services/live/liveChannels";

// Figma: funnation-popular-live-page 617:5 (인기라이브)
export const metadata: Metadata = { title: "인기 라이브 | Somnation" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const sections = await getPopularLiveSections();
  return <PopularLiveScreen sections={sections} />;
}
