import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OneSourceOverlay } from "@/features/creatorStudio/widgets/OneSourceOverlay";
import { getOneSource } from "@/services/creator/overlayLayout";

// Code-first (no Figma frame): 원소스 오버레이 — every overlay placed on one canvas (?canvas=pc · landscape · portrait).
export const metadata: Metadata = { title: "원소스 오버레이", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ canvas?: string }> }) {
  const [{ key }, { canvas }] = await Promise.all([params, searchParams]);
  const data = await getOneSource(key, canvas);
  // An invalid key looks like a missing page.
  if (data === "FORBIDDEN") notFound();
  return <OneSourceOverlay data={data} />;
}
