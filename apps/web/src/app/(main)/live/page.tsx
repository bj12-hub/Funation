import type { Metadata } from "next";
import { AllLiveScreen } from "@/features/live";
import { FLEXTV_LIVE } from "@/lib/flextv/mode";
import { getT } from "@/lib/i18n/server";
import { getAllLiveChannels } from "@/services/live/liveChannels";

// Figma: funnation-all-live-page 617:316 (전체라이브), without the category chips; with FLEXTV (phase 10) FLEXTV's 방송
// 카테고리 as chips (`?category=`) and a sort.
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("live.metaAll") };
}
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ category?: string | string[] }> }) {
  const [channels, { category }] = await Promise.all([getAllLiveChannels(), searchParams]);
  return <AllLiveScreen channels={channels} byCategory={FLEXTV_LIVE} initialCategory={typeof category === "string" ? category : null} />;
}
