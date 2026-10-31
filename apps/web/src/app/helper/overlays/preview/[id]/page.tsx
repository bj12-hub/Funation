import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OVERLAYS, PREVIEW_TESTABLE } from "@/services/creator/overlayCatalog";
import { OverlayPreview } from "@/features/creatorStudio/widgets/OverlayPreview";
import { getOverlaySwitches } from "@/services/creator/alertRemote";
import { getOverlayKey } from "@/services/creator/broadcastTools";
import { getT } from "@/lib/i18n/server";

// Code-first (no Figma frame): 오버레이 미리보기, on the helper domain — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("helper.metaOverlayPreview") };
}
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = OVERLAYS.find((o) => o.id === id);
  if (!entry) notFound();
  const [key, switches] = await Promise.all([getOverlayKey(), getOverlaySwitches()]);
  if (!key || !switches) return null;
  return (
    <OverlayPreview
      title={entry.title}
      description={entry.description}
      size={entry.size}
      src={entry.path(key)}
      manage={entry.manage}
      on={switches[entry.target]}
      testable={PREVIEW_TESTABLE.has(entry.id)}
    />
  );
}
