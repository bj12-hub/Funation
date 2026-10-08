import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BannerOverlay } from "@/features/creatorStudio/widgets/library/BannerOverlay";
import { getOverlayBanner } from "@/services/creator/banner";

// Code-first (no Figma frame): OBS browser source for 배너.
export const metadata: Metadata = { title: "배너 오버레이", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  const data = await getOverlayBanner((await params).key);
  // An invalid key looks like a missing page.
  if (data === "FORBIDDEN") notFound();
  return <BannerOverlay data={data} />;
}
