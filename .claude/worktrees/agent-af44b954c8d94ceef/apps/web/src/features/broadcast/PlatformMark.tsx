import { PLATFORM_LABEL, type Platform } from "@/types/platform";
import styles from "./chat.module.css";

/** Letter mark per platform (no third-party logos). Colour comes from `data-platform` in chat.module.css. */
const GLYPH: Record<Platform, string> = { YOUTUBE: "Y", CHZZK: "치", SOOP: "S", FLEXTV: "F" };

export function PlatformMark({ platform, size = "md" }: { platform: Platform; size?: "sm" | "md" }) {
  return (
    <span className={styles.mark} data-platform={platform} data-size={size} title={PLATFORM_LABEL[platform]} aria-label={PLATFORM_LABEL[platform]} role="img">
      {GLYPH[platform]}
    </span>
  );
}
