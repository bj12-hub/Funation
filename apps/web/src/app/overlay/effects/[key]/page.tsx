import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EffectsOverlay } from "@/features/creatorStudio/widgets/EffectsOverlay";
import { getOverlayEffects } from "@/services/creator/effects";

// Code-first (no Figma frame): OBS browser source for 이모지 리액션 · 레이어 효과.
export const metadata: Metadata = { title: "후원 이펙트 오버레이", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  const data = await getOverlayEffects((await params).key);
  // An invalid key looks like a missing page.
  if (data === "FORBIDDEN") notFound();
  return <EffectsOverlay data={data} />;
}
