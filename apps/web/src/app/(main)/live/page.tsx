import type { Metadata } from "next";
import { AllLiveScreen } from "@/features/live";
import { getAllLiveChannels, LIVE_CATEGORY_LABEL, type LiveCategory } from "@/services/live/liveChannels";

// Figma: funnation-all-live-page 617:316 (전체라이브)
export const metadata: Metadata = { title: "LIVE | Somnation" };
export const dynamic = "force-dynamic";

function parseCategory(value: string | string[] | undefined): LiveCategory | undefined {
  return typeof value === "string" && value in LIVE_CATEGORY_LABEL ? (value as LiveCategory) : undefined;
}

export default async function Page({ searchParams }: { searchParams: Promise<{ category?: string | string[] }> }) {
  const [{ category }, channels] = await Promise.all([searchParams, getAllLiveChannels()]);
  return <AllLiveScreen channels={channels} initialCategory={parseCategory(category)} />;
}
