import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BridgeOverlay } from "@/features/creatorStudio/widgets/BridgeOverlay";
import { getBridgeData } from "@/services/creator/bridge";

// Code-first (no Figma frame): 외부 프로그램 연동 페이지 — sends the rules' requests from the streaming PC (?status shows them).
export const metadata: Metadata = { title: "외부 프로그램 연동", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ status?: string }> }) {
  const [{ key }, { status }] = await Promise.all([params, searchParams]);
  const data = await getBridgeData(key);
  // An invalid key looks like a missing page.
  if (data === "FORBIDDEN") notFound();
  return <BridgeOverlay overlayKey={key} data={data} status={status !== undefined} />;
}
