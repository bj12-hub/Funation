import type { Metadata } from "next";
import { AllLiveScreen } from "@/features/live";
import { getAllLiveChannels } from "@/services/live/liveChannels";

// Figma: funnation-all-live-page 617:316 (전체라이브), without the category chips
export const metadata: Metadata = { title: "전체 방송 | Ssumnation" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const channels = await getAllLiveChannels();
  return <AllLiveScreen channels={channels} />;
}
