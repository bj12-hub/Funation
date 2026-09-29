import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VideoOverlay } from "@/features/creatorStudio/widgets/media/MediaOverlays";
import { getOverlayVideo } from "@/services/creator/media";

// Code-first (no Figma frame): OBS browser source for 영상 후원.
export const metadata: Metadata = { title: "영상 후원 오버레이", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  const data = await getOverlayVideo((await params).key);
  // An invalid key looks like a missing page.
  if (data === "FORBIDDEN") notFound();
  return <VideoOverlay data={data} />;
}
