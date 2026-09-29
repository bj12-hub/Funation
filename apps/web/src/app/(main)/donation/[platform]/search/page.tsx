import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PlatformSearchScreen } from "@/features/platformDonation/PlatformSearchScreen";
import { searchPlatformCreators } from "@/services/platformDonation/platformDonation";
import { PLATFORMS, platformFromSlug } from "@/services/platformDonation/platformTypes";

// Figma: SOOP 검색 817:9146 · FlexTV 검색 817:8449
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ platform: string }>; searchParams: Promise<{ q?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const platform = platformFromSlug((await params).platform);
  return { title: platform ? `${PLATFORMS[platform].name} ${PLATFORMS[platform].creatorWord} 검색 | Funation` : "Funation" };
}

export default async function Page({ params, searchParams }: Props) {
  const [{ platform: slug }, { q = "" }] = await Promise.all([params, searchParams]);
  const platform = platformFromSlug(slug);
  if (!platform) notFound();
  const data = await searchPlatformCreators(platform, q);
  if (!data) redirect(`/login?next=/donation/${slug}/search`);
  return <PlatformSearchScreen platform={platform} query={q.trim()} balance={data.balance} results={data.results} />;
}
