import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { OVERLAYS, PREVIEW_TESTABLE } from "@/services/creator/overlayCatalog";
import { OverlayPreview } from "@/features/creatorStudio/widgets/OverlayPreview";
import { overlayDescription, overlaySize, overlayTitle } from "@/features/creatorStudio/widgets/overlayCatalogText";
import { getT } from "@/lib/i18n/server";
import { getOverlaySwitches } from "@/services/creator/alertRemote";
import { getOverlayKey } from "@/services/creator/broadcastTools";

// Code-first (no Figma frame): 오버레이 미리보기 — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("studioToolsOverlays.metaPreview") };
}
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [key, switches] = await Promise.all([getOverlayKey(), getOverlaySwitches()]);
  if (!key || !switches) redirect(`/login?role=creator&next=${encodeURIComponent(`/creator/widgets/overlays/preview/${id}`)}`);
  const entry = OVERLAYS.find((o) => o.id === id);
  if (!entry) notFound();
  const t = await getT();
  return (
    <OverlayPreview
      title={overlayTitle(entry, t)}
      description={overlayDescription(entry, t)}
      size={overlaySize(entry, t)}
      src={entry.path(key)}
      manage={entry.manage}
      on={switches[entry.target]}
      testable={PREVIEW_TESTABLE.has(entry.id)}
    />
  );
}
