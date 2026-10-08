import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { OVERLAYS } from "@/features/creatorStudio/widgets/overlayCatalog";
import { OverlayPreview } from "@/features/creatorStudio/widgets/OverlayPreview";
import { getOverlaySwitches } from "@/services/creator/alertRemote";
import { getOverlayKey } from "@/services/creator/broadcastTools";

// Code-first (no Figma frame): 오버레이 미리보기 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "오버레이 미리보기 | Ssumnation 크리에이터" };
export const dynamic = "force-dynamic";

/** Overlays that show a 테스트 후원 (the alert feed): 후원 알림, 이펙트, 벽지. */
const TESTABLE = new Set(["alert", "effects", "widget-wallpaper", "alert-vertical"]);

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [key, switches] = await Promise.all([getOverlayKey(), getOverlaySwitches()]);
  if (!key || !switches) redirect(`/login?role=creator&next=${encodeURIComponent(`/creator/widgets/overlays/preview/${id}`)}`);
  const entry = OVERLAYS.find((o) => o.id === id);
  if (!entry) notFound();
  return (
    <OverlayPreview
      title={entry.title}
      description={entry.description}
      size={entry.size}
      src={entry.path(key)}
      manage={entry.manage}
      on={switches[entry.target]}
      testable={TESTABLE.has(entry.id)}
    />
  );
}
