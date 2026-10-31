import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { widgetPageText } from "@/features/helper/helperText";
import { WidgetFeaturePage } from "@/features/helper/WidgetFeaturePage";
import { widgetPageOf } from "@/features/helper/widgetPages";
import { getT } from "@/lib/i18n/server";
import { getOverlaySwitches } from "@/services/creator/alertRemote";
import { getWidgetDetail } from "@/services/creator/widgetSettings";

// Code-first (no Figma frame): 도우미 위젯 기능 페이지 (후원 알림 · 채팅창 · 목표치 · 후원 자막 · 시계 · QR · 벽지 · 퀘스트 ·
// 투표 · 룰렛 · 뽑기) — see features/helper/widgetPages.ts and docs/figma/code-first-screens.md
export const dynamic = "force-dynamic";

type Params = Promise<{ feature: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { feature } = await params;
  const page = widgetPageOf(feature);
  const t = await getT();
  return { title: page ? widgetPageText(feature, page, t).title : t("helper.metaNotFound") };
}

export default async function Page({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const [{ feature }, raw] = await Promise.all([params, searchParams]);
  const page = widgetPageOf(feature);
  if (!page) notFound();
  const tab = page.tabs.find((t) => t.slug === raw.tab) ?? page.tabs[0];
  const [detail, switches] = await Promise.all([getWidgetDetail(tab.key), getOverlaySwitches()]);
  if (!detail || !switches) return null;
  // Keyed by widget: another tab starts a fresh editor with its own saved settings.
  return <WidgetFeaturePage key={tab.key} feature={feature} page={page} tab={tab.slug} detail={detail} switches={switches} />;
}
