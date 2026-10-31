import type { MessageKey } from "@/lib/i18n/translate";
import type { OverlayTheme } from "@/services/creator/overlayThemeTypes";

/**
 * Each 오버레이 테마's label · summary · mood as message keys (2026-11-01); the service's OVERLAY_THEMES stay as written.
 * Studio-only: overlays never show these names.
 */
export const THEME_TEXT: Record<OverlayTheme, { label: MessageKey; summary: MessageKey; mood: MessageKey }> = {
  BOLD: { label: "studioToolsTheme.labelBold", summary: "studioToolsTheme.summaryBold", mood: "studioToolsTheme.moodBold" },
  PILL: { label: "studioToolsTheme.labelPill", summary: "studioToolsTheme.summaryPill", mood: "studioToolsTheme.moodPill" },
  GLASS: { label: "studioToolsTheme.labelGlass", summary: "studioToolsTheme.summaryGlass", mood: "studioToolsTheme.moodGlass" }
};
