import { FlextvUnavailableError } from "@/lib/flextv/client";
import { fetchMyDesign, fetchOverlayDesign, saveMyDesign } from "@/lib/flextv/overlayDesign";
import { createQueue } from "@/lib/flextv/queue";
import { requestDeviceContext } from "@/lib/flextv/request";
import { fetchMySettings } from "@/lib/flextv/ssumnation";
import { fetchOverlayKey } from "@/lib/flextv/ssumnationBroadcast";
import { studioContext, type StudioContext } from "./flextvStudio";
import { DEFAULT_DESIGN, designBody, designedSettings, designPartOf, isDesignWidget, parseAppearance, readDesign, type DesignWidget, type FlextvOverlayDesign } from "./flextvOverlayDesign";
import type { OverlayAppearance } from "./overlayThemeTypes";
import { RANKING_WIDGET_PERIODS, type WidgetDetail, type WidgetLiveData, type WidgetSaveResult } from "./widgetSettingsTypes";

/**
 * 위젯 · 오버레이 테마 with FLEXTV (phase 8, docs/development/flextv-ssumnation-api.md §10): the look of the overlays
 * FLEXTV runs, set on the studio's 위젯 page and kept by FLEXTV as one document per streamer. ./overlayTheme.ts and
 * ./widgetSettings.ts delegate here with FLEXTV_SSUMNATION_API; the overlays read it by their key (./flextvBroadcastGames.ts).
 * Only the look is set here: the rules are 후원 종류 설정's.
 */

const serialize = createQueue("overlayDesign");
const OVERLAY_SLUG: Record<DesignWidget, string> = { ROULETTE: "roulette", GACHA: "gacha", QUEST: "quest", MINI: "mini" };
const UNREACHABLE = "FLEXTV가 응답하지 않았어요. 잠시 후 다시 시도해 주세요.";

async function designOf(ctx: StudioContext): Promise<FlextvOverlayDesign | null> {
  const raw = await fetchMyDesign(ctx.token);
  return raw === "UNAUTHORIZED" ? null : readDesign(raw ?? DEFAULT_DESIGN);
}

/** Reads the document, changes one part and sends it back, one save at a time per streamer. */
async function saveDesign(change: (design: FlextvOverlayDesign) => FlextvOverlayDesign): Promise<WidgetSaveResult> {
  const ctx = await studioContext();
  if (!ctx) return { status: "UNAUTHORIZED" };
  const context = await requestDeviceContext();
  return serialize(ctx.session.userId, async () => {
    try {
      const current = await designOf(ctx);
      if (!current) return { status: "UNAUTHORIZED" };
      const outcome = await saveMyDesign(ctx.token, context, designBody(change(current)));
      if (outcome.kind === "SAVED") return { status: "SAVED" };
      if (outcome.kind === "UNAUTHORIZED") return { status: "UNAUTHORIZED" };
      return { status: "INVALID", message: outcome.message ?? "FLEXTV가 설정을 받지 않았어요. 값을 확인해 주세요." };
    } catch (error) {
      if (error instanceof FlextvUnavailableError) return { status: "INVALID", message: UNREACHABLE };
      throw error;
    }
  });
}

export async function getFlextvAppearance(): Promise<OverlayAppearance | null> {
  const ctx = await studioContext();
  return ctx ? ((await designOf(ctx))?.appearance ?? null) : null;
}

export async function saveFlextvAppearance(input: unknown): Promise<WidgetSaveResult> {
  const appearance = parseAppearance(input);
  if (typeof appearance === "string") return { status: "INVALID", message: appearance };
  return saveDesign((design) => ({ ...design, appearance }));
}

const liveData = (design: FlextvOverlayDesign, overlayKey: string, miniMinAmount: number): WidgetLiveData => ({
  goalCurrent: 0,
  totalAmount: 0,
  qrImageUrl: "",
  ranking: [],
  crewRanking: Object.fromEntries(RANKING_WIDGET_PERIODS.map((p) => [p, []])) as unknown as WidgetLiveData["crewRanking"],
  sourceBoard: [],
  miniMinAmount,
  gachaBoardUrl: `/overlay/widget/gacha-board/${overlayKey}`,
  gachaWins: [],
  gachaUnclaimed: 0,
  appearance: design.appearance,
  donors: [],
  topNow: null,
  sigWalls: [],
  sigWallPath: "",
  designOnly: true
});

/** The 룰렛 · 뽑기 · 퀘스트 · 미니 popups; the other widgets have no FLEXTV overlay (null). */
export async function getFlextvWidgetDetail(key: unknown): Promise<WidgetDetail | null> {
  if (!isDesignWidget(key)) return null;
  const ctx = await studioContext();
  if (!ctx) return null;
  const [design, types, overlayKey] = await Promise.all([designOf(ctx), fetchMySettings(ctx.token), fetchOverlayKey(ctx.token, null)]);
  if (!design || !overlayKey) return null;
  return {
    key,
    url: "",
    overlayPath: `/overlay/widget/${OVERLAY_SLUG[key]}/${overlayKey}`,
    settings: designedSettings(design, types)[key],
    live: liveData(design, overlayKey, types?.mini.minAmount ?? 1)
  } as WidgetDetail;
}

export async function saveFlextvWidget(key: unknown, input: unknown): Promise<WidgetSaveResult> {
  if (!isDesignWidget(key)) return { status: "INVALID", message: "FLEXTV에서는 설정할 수 없는 위젯이에요." };
  const part = designPartOf(key, input);
  if (typeof part === "string") return { status: "INVALID", message: part };
  return saveDesign((design) => ({ ...design, ...part }));
}

/* ── The overlays ────────────────────────────────────────── */

/** Overlays ask every 2 seconds: one read per key a second per server is enough for a change to show. */
const DESIGN_TTL_MS = 1_000;
const MAX_CACHED = 500;
const g = globalThis as typeof globalThis & { __ssumnationFlextvOverlayDesigns?: Map<string, { at: number; design: Promise<FlextvOverlayDesign | undefined> }> };
const cache = (g.__ssumnationFlextvOverlayDesigns ??= new Map());

/** An overlay's design by its key; `undefined` for a key FLEXTV does not know. FLEXTV unreachable: the default look. */
export function overlayDesign(key: string): Promise<FlextvOverlayDesign | undefined> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < DESIGN_TTL_MS) return hit.design;
  if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value!);
  const design = fetchOverlayDesign(key).then(
    (raw) => (raw === undefined ? undefined : readDesign(raw ?? DEFAULT_DESIGN)),
    () => DEFAULT_DESIGN
  );
  cache.set(key, { at: Date.now(), design });
  return design;
}
