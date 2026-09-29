import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PlatformDonationFlow } from "@/features/platformDonation/PlatformDonationFlow";
import { getPlatformCreatorDetail } from "@/services/platformDonation/platformDonation";
import { PLATFORMS, platformFromSlug } from "@/services/platformDonation/platformTypes";

// Figma: SOOP 817:9242 · 9334 · 9411 · 9509 · 9553 · 9618 — FlexTV 817:8529 · 8597 · 8684 · 8761 · 8843 · 8886 · 8948
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ platform: string; creatorId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const platform = platformFromSlug((await params).platform);
  return { title: platform ? `${PLATFORMS[platform].name} 후원 | Funation` : "Funation" };
}

export default async function Page({ params }: Props) {
  const { platform: slug, creatorId } = await params;
  const platform = platformFromSlug(slug);
  if (!platform) notFound();
  const detail = await getPlatformCreatorDetail(platform, creatorId);
  if (detail === "UNAUTHORIZED") redirect(`/login?next=/donation/${slug}/${creatorId}`);
  if (detail === "NOT_FOUND") notFound();
  return <PlatformDonationFlow detail={detail} />;
}
