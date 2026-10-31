import { PLATFORM_LABEL, type Platform } from "@/types/platform";
import type { MessageKey } from "./translate";

/**
 * A platform's name in the viewer's language on the site and in the studio (2026-11-01): 치지직 reads CHZZK in English,
 * YouTube · FlexTV · SOOP read the same in both. OBS overlays and text written by the services keep `PLATFORM_LABEL`.
 */
export function platformLabel(platform: Platform, t: (key: MessageKey) => string) {
  return platform === "CHZZK" ? t("common.chzzk") : PLATFORM_LABEL[platform];
}
