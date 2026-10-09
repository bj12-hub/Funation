import { DEFAULT_WIDGET_SETTINGS, type EditableWidgetKey, type WidgetSettingsMap } from "./widgetSettingsTypes";

/**
 * Server-only widget settings store (not a "use server" module): the settings actions write it and the
 * 후원 위젯 OBS overlays read it.
 */
const g = globalThis as typeof globalThis & { __ssumnationMockWidgetsV4?: WidgetSettingsMap };
export const widgetStore = (g.__ssumnationMockWidgetsV4 ??= structuredClone(DEFAULT_WIDGET_SETTINGS));
// A store created before a widget existed (e.g. 룰렛) starts that widget from its defaults.
for (const key of Object.keys(DEFAULT_WIDGET_SETTINGS) as (keyof WidgetSettingsMap)[]) {
  (widgetStore as Record<string, unknown>)[key] ??= structuredClone(DEFAULT_WIDGET_SETTINGS[key]);
}

/** A copy of one widget's settings; fields added later (e.g. 치지직 최근알림 문구) read with their defaults. */
export function readWidget<K extends EditableWidgetKey>(key: K): WidgetSettingsMap[K] {
  const copy = structuredClone(widgetStore[key]);
  if (key === "RECENT") {
    const recent = copy as WidgetSettingsMap["RECENT"];
    recent.templates = { ...DEFAULT_WIDGET_SETTINGS.RECENT.templates, ...recent.templates };
  }
  if (key === "ROULETTE") {
    // 룰렛 settings saved before 결과 자동 노출 read with its default.
    return { ...DEFAULT_WIDGET_SETTINGS.ROULETTE, ...copy } as WidgetSettingsMap[K];
  }
  if (key === "QR" || key === "TOTAL" || key === "RECENT" || key === "EVENT" || key === "RANKING" || key === "MINI") {
    // Saved before 오버레이 테마 (2026-10-08): 전체 테마 따르기, and no 배경 카드 so the look stays as it was.
    const themed = copy as { theme?: string; card?: boolean };
    themed.theme ??= "INHERIT";
    if (key !== "QR" && key !== "EVENT") themed.card ??= false;
  }
  if (key === "QUEST" || key === "VOTE" || key === "ROULETTE" || key === "WALLPAPER") {
    (copy as { theme?: string }).theme ??= "INHERIT";
  }
  if (key === "GACHA") {
    (copy as WidgetSettingsMap["GACHA"]).overlayTheme ??= "INHERIT";
  }
  if (key === "GOAL") {
    // 후원목표 saved before 오버레이 테마 · 모양 · 두 번째 목표 (2026-10-08) reads with those defaults (its colors kept).
    const d = DEFAULT_WIDGET_SETTINGS.GOAL;
    const goal = copy as WidgetSettingsMap["GOAL"];
    goal.theme ??= d.theme;
    goal.shape ??= d.shape;
    goal.customColors ??= true;
    goal.second ??= structuredClone(d.second);
    goal.alternateSec ??= d.alternateSec;
  }
  if (key === "CHAT") {
    // 채팅창 saved before 오버레이 테마 (2026-10-08) follows the 전체 테마.
    (copy as WidgetSettingsMap["CHAT"]).theme ??= "INHERIT";
  }
  if (key === "RANKING") {
    // Settings saved before 랭킹 종류 (2026-10-06) read as 후원자 랭킹, like the parser does.
    (copy as WidgetSettingsMap["RANKING"]).board ??= "DONOR";
  }
  if (key === "VOTE") {
    // Presets saved before 무료 투표 (2026-10-04) carried a price and 무료 투표권; drop them.
    const vote = copy as WidgetSettingsMap["VOTE"];
    vote.presets = vote.presets.map(({ id, name, color, durationSec, items }) => ({ id, name, color, durationSec, items }));
  }
  return copy;
}
