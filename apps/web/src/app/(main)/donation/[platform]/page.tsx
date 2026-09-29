import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PlatformHomeScreen } from "@/features/platformDonation/PlatformHomeScreen";
import { getPlatformHome } from "@/services/platformDonation/platformDonation";
import { PLATFORMS, platformFromSlug } from "@/services/platformDonation/platformTypes";

// Figma: SOOP 후원 817:9017 · FlexTV 후원 817:8317
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ platform: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const platform = platformFromSlug((await params).platform);
  return { title: platform ? `${PLATFORMS[platform].name} 후원 | Funation` : "Funation" };
}

export default async function Page({ params }: Props) {
  const slug = (await params).platform;
  const platform = platformFromSlug(slug);
  if (!platform) notFound();
  const home = await getPlatformHome(platform);
  if (!home) redirect(`/login?next=/donation/${slug}`);
  return <PlatformHomeScreen home={home} />;
}
