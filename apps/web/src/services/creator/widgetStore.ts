import { DEFAULT_WIDGET_SETTINGS, type EditableWidgetKey, type WidgetSettingsMap } from "./widgetSettingsTypes";

/**
 * Server-only widget settings store (not a "use server" module): the settings actions write it and the
 * 후원 위젯 OBS overlays read it.
 */
const g = globalThis as typeof globalThis & { __funationMockWidgetsV4?: WidgetSettingsMap };
export const widgetStore = (g.__funationMockWidgetsV4 ??= structuredClone(DEFAULT_WIDGET_SETTINGS));

/** A copy of one widget's settings; fields added later (e.g. 치지직 최근알림 문구) read with their defaults. */
export function readWidget<K extends EditableWidgetKey>(key: K): WidgetSettingsMap[K] {
  const copy = structuredClone(widgetStore[key]);
  if (key === "RECENT") {
    const recent = copy as WidgetSettingsMap["RECENT"];
    recent.templates = { ...DEFAULT_WIDGET_SETTINGS.RECENT.templates, ...recent.templates };
  }
  return copy;
}
