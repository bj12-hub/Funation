import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CustomOverlay } from "@/features/creatorStudio/widgets/CustomOverlay";
import { getCustomOverlay } from "@/services/creator/customOverlay";

// Code-first (no Figma frame): 커스텀 오버레이 — the creator's HTML · CSS · JS in a sandboxed frame (?slot=1~5).
export const metadata: Metadata = { title: "커스텀 오버레이", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ slot?: string }> }) {
  const [{ key }, { slot }] = await Promise.all([params, searchParams]);
  const data = await getCustomOverlay(key, slot);
  // An invalid key looks like a missing page.
  if (data === "FORBIDDEN") notFound();
  return <CustomOverlay data={data} />;
}
