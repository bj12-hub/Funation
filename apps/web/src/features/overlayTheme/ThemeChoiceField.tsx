"use client";

import { useId } from "react";
import { OVERLAY_THEMES, THEME_DEFAULT_ACCENT, type OverlayAppearance, type OverlayThemeChoice } from "@/services/creator/overlayThemeTypes";
import s from "./themeChoice.module.css";

/**
 * A widget's own theme (code-first, 2026-10-08): 전체 테마 따르기 or one of the three looks, as small swatch
 * chips. The 전체 테마 chip names the theme it currently means.
 */
export function ThemeChoiceField({ value, onChange, appearance }: { value: OverlayThemeChoice; onChange: (v: OverlayThemeChoice) => void; appearance: OverlayAppearance }) {
  const name = useId();
  const current = OVERLAY_THEMES.find((t) => t.key === appearance.theme)?.label ?? "";
  const options: { key: OverlayThemeChoice; label: string; sub?: string; swatch: string }[] = [
    { key: "INHERIT", label: "전체 테마 따르기", sub: current, swatch: appearance.theme },
    ...OVERLAY_THEMES.map((t) => ({ key: t.key, label: t.label, swatch: t.key }))
  ];
  return (
    <div role="radiogroup" aria-label="테마" className={s.group}>
      {options.map((o) => (
        <label key={o.key} className={s.option} data-checked={value === o.key || undefined}>
          <input type="radio" name={name} className={s.srOnly} checked={value === o.key} onChange={() => onChange(o.key)} />
          <span className={s.swatch} data-ov-swatch={o.swatch} style={{ ["--sw-accent" as string]: appearance.accent ?? THEME_DEFAULT_ACCENT[o.swatch as keyof typeof THEME_DEFAULT_ACCENT] }} aria-hidden="true" />
          <span className={s.text}>
            {o.label}
            {o.sub && <small>{o.sub}</small>}
          </span>
        </label>
      ))}
    </div>
  );
}
