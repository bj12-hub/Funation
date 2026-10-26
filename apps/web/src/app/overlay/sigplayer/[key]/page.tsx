import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SigPlayerOverlay } from "@/features/creatorStudio/widgets/SigPlayerOverlay";
import { getOverlaySigPlayer } from "@/services/creator/sigPlayer";

// Code-first (no Figma frame): OBS browser source for the 시그니처 플레이어 (2026-10-25, StreamDonate 참고).
export const metadata: Metadata = { title: "시그니처 플레이어 오버레이", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  const data = await getOverlaySigPlayer((await params).key);
  // An invalid key looks like a missing page.
  if (data === "FORBIDDEN") notFound();
  return <SigPlayerOverlay data={data} />;
}
