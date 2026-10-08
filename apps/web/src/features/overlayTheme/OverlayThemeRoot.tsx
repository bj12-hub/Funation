import type { CSSProperties, ElementType, HTMLAttributes } from "react";
import type { ResolvedTheme } from "@/services/creator/overlayThemeTypes";
import ov from "./overlayTheme.module.css";

/**
 * The element every themed overlay (and its studio preview) draws inside: it carries the theme's tokens
 * (`data-ov`) and the creator's 포인트 색상. Server- and client-safe.
 */
export function OverlayThemeRoot({ theme, as: Tag = "div", className, style, ...rest }: { theme: ResolvedTheme; as?: ElementType } & HTMLAttributes<HTMLElement>) {
  return (
    <Tag
      {...rest}
      data-ov={theme.theme}
      className={className ? `${ov.root} ${className}` : ov.root}
      style={{ "--ov-accent": theme.accent, "--ov-accent-ink": theme.accentInk, ...style } as CSSProperties}
    />
  );
}

export { ov };
