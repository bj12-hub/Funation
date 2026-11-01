import { PLATFORM_LABEL, type Platform } from "@/types/platform";
import styles from "./chat.module.css";

/** Letter mark per platform (no third-party logos). Colour comes from `data-platform` in chat.module.css. */
const GLYPH: Record<Platform, string> = { YOUTUBE: "Y", CHZZK: "치", SOOP: "S", FLEXTV: "F" };

/** `label` names the mark for the tooltip and screen readers: the studio passes it in the viewer's language, OBS keeps the Korean one. */
export function PlatformMark({ platform, size = "md", label = PLATFORM_LABEL[platform] }: { platform: Platform; size?: "sm" | "md"; label?: string }) {
  return (
    <span className={styles.mark} data-platform={platform} data-size={size} title={label} aria-label={label} role="img">
      {GLYPH[platform]}
    </span>
  );
}
