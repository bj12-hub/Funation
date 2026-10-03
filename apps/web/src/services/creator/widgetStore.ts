import { DEFAULT_WIDGET_SETTINGS, type EditableWidgetKey, type WidgetSettingsMap } from "./widgetSettingsTypes";

/**
 * Server-only widget settings store (not a "use server" module): the settings actions write it and the
 * 후원 위젯 OBS overlays read it.
 */
const g = globalThis as typeof globalThis & { __funationMockWidgetsV4?: WidgetSettingsMap };
export const widgetStore = (g.__funationMockWidgetsV4 ??= structuredClone(DEFAULT_WIDGET_SETTINGS));
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
  if (key === "VOTE") {
    // Presets saved before 무료 투표 (2026-10-04) carried a price and 무료 투표권; drop them.
    const vote = copy as WidgetSettingsMap["VOTE"];
    vote.presets = vote.presets.map(({ id, name, color, durationSec, items }) => ({ id, name, color, durationSec, items }));
  }
  return copy;
}
