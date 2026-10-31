import type { Metadata } from "next";
import { AllLiveScreen } from "@/features/live";
import { getT } from "@/lib/i18n/server";
import { getAllLiveChannels } from "@/services/live/liveChannels";

// Figma: funnation-all-live-page 617:316 (전체라이브), without the category chips
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("live.metaAll") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  const channels = await getAllLiveChannels();
  return <AllLiveScreen channels={channels} />;
}
