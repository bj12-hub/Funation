"use client";

import type { CSSProperties } from "react";
import { OverlayThemeRoot } from "@/features/overlayTheme/OverlayThemeRoot";
import type { ResolvedTheme } from "@/services/creator/overlayThemeTypes";
import type { SigWallCard } from "@/services/creator/widgetOverlayTypes";
import { SIG_WALL_PAD, sigWallSize, type SigWallLine, type SigWallpaperSettings } from "@/services/creator/widgetSettingsTypes";
import w from "./sigWallpaper.module.css";

/**
 * 시그 벽지 (code-first, 2026-10-28 — StreamDonate 시그 벽지 참고): one 시그니처 후원 as a card — its signature image,
 * "○○○님, 후원 감사합니다." and the amount — drawn by the OBS overlay and the settings preview. Nothing without a card.
 */

/** #RRGGBB at `opacity` %. */
const rgba = (hex: string, opacity: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacity / 100})`;
};

const lineStyle = (l: SigWallLine, family: string): CSSProperties => ({
  fontFamily: `"${family}", var(--ov-body-font)`,
  fontSize: l.size,
  color: l.color,
  WebkitTextStroke: l.stroke ? `${l.stroke}px ${l.strokeColor}` : undefined,
  paintOrder: "stroke fill"
});

export function SigWallpaperView({ settings: s, card, theme }: { settings: SigWallpaperSettings; card: SigWallCard | null; theme: ResolvedTheme }) {
  if (!card) return null;
  const pad = s.imagePad ? SIG_WALL_PAD : 0;
  const size = sigWallSize(s);
  return (
    <OverlayThemeRoot theme={theme} className={w.stage}>
      <div className={w.card} style={{ width: size.w, background: rgba(s.bgColor, s.bgOpacity), borderRadius: s.radius, padding: `${pad}px ${pad}px 0` }}>
        <div className={w.image} style={{ width: s.imageWidth, height: s.imageHeight, borderRadius: pad ? Math.max(0, s.radius - pad / 2) : s.radius }}>
          {card.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- signature images are library assets or data URLs in the mock
            <img src={card.imageUrl} alt="" />
          )}
        </div>
        <p className={w.top} style={{ ...lineStyle(s.top, s.font), marginTop: s.gapImage }}>
          <span style={{ color: s.top.accent }}>{card.donor}</span>
          {s.topLine === "THANKS" && "님, 후원 감사합니다."}
        </p>
        <p className={w.bottom} style={{ ...lineStyle(s.bottom, s.font), marginTop: s.gapLines, marginBottom: s.gapBottom }}>
          {s.amountPrefix}
          <span style={{ color: s.bottom.accent, fontWeight: s.bottom.bold ? 800 : 500 }}>{card.amount}</span>
        </p>
      </div>
    </OverlayThemeRoot>
  );
}
