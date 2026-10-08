import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { PlatformDonationFlow } from "@/features/platformDonation/PlatformDonationFlow";
import { getPlatformCreatorDetail } from "@/services/platformDonation/platformDonation";
import { PLATFORMS, platformFromSlug } from "@/services/platformDonation/platformTypes";

// Figma: SOOP 817:9242 · 9334 · 9411 · 9509 · 9553 · 9618 — FlexTV 817:8529 · 8597 · 8684 · 8761 · 8843 · 8886 · 8948
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ platform: string; creatorId: string }> };

// One read per request for the title and the page.
const readDetail = cache(getPlatformCreatorDetail);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { platform: slug, creatorId } = await params;
  const platform = platformFromSlug(slug);
  if (!platform) return { title: "Ssumnation" };
  const detail = await readDetail(platform, creatorId);
  const name = typeof detail === "object" ? `${detail.creator.nickname} · ` : "";
  return { title: `${name}${PLATFORMS[platform].name} 후원 | Ssumnation` };
}

export default async function Page({ params }: Props) {
  const { platform: slug, creatorId } = await params;
  const platform = platformFromSlug(slug);
  if (!platform) notFound();
  const detail = await readDetail(platform, creatorId);
  if (detail === "UNAUTHORIZED") redirect(`/login?next=/donation/${slug}/${creatorId}`);
  if (detail === "NOT_FOUND") notFound();
  return <PlatformDonationFlow detail={detail} />;
}
