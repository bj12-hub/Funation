import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToolOverlay } from "@/features/creatorStudio/widgets/ToolOverlay";
import { getOverlayTool } from "@/services/creator/broadcastTools";

// Code-first (no Figma frame): OBS browser-source overlays for 방송 도구.
export const metadata: Metadata = { title: "방송 도구 오버레이", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ tool: string; key: string }> }) {
  const { tool, key } = await params;
  const data = await getOverlayTool(tool, key);
  // An invalid key or tool looks like a missing page.
  if (data === "FORBIDDEN") notFound();
  return <ToolOverlay data={data} />;
}
