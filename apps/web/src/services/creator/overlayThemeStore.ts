import { DEFAULT_OVERLAY_APPEARANCE, resolveTheme, type OverlayAppearance, type OverlayThemeChoice, type ResolvedTheme } from "./overlayThemeTypes";

/**
 * Server-only store for the channel's 전체 테마 (not a "use server" module): the 위젯 page saves it and every OBS
 * overlay reads it.
 */
const g = globalThis as typeof globalThis & { __ssumnationMockOverlayThemeV1?: OverlayAppearance };

export const readAppearance = (): OverlayAppearance => structuredClone((g.__ssumnationMockOverlayThemeV1 ??= structuredClone(DEFAULT_OVERLAY_APPEARANCE)));

export const writeAppearance = (a: OverlayAppearance) => {
  g.__ssumnationMockOverlayThemeV1 = { theme: a.theme, accent: a.accent };
};

/** The look an overlay draws with: its widget's choice (or 전체 테마 따르기) over the channel's 전체 테마. */
export const overlayTheme = (choice?: OverlayThemeChoice | null): ResolvedTheme => resolveTheme(readAppearance(), choice);
