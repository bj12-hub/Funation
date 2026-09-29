import type { CSSProperties } from "react";

/** Preview text size, scaled down so large overlay sizes still fit the popup. */
export const previewSize = (px: number) => Math.round(Math.min(Math.max(px * 0.7, 12), 24));

export const fontStyle = (f: { family: string; size: number; color?: string }, outline = false): CSSProperties => ({
  fontFamily: `"${f.family}", var(--font-sans)`,
  fontSize: previewSize(f.size),
  color: f.color,
  textShadow: outline ? "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000" : undefined
});
