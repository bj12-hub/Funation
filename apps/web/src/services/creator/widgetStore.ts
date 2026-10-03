import { DEFAULT_WIDGET_SETTINGS, type WidgetSettingsMap } from "./widgetSettingsTypes";

/**
 * Server-only widget settings store (not a "use server" module): the settings actions write it and the
 * 후원 위젯 OBS overlays read it.
 */
const g = globalThis as typeof globalThis & { __funationMockWidgetsV4?: WidgetSettingsMap };
export const widgetStore = (g.__funationMockWidgetsV4 ??= structuredClone(DEFAULT_WIDGET_SETTINGS));
