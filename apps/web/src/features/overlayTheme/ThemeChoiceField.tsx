"use client";

import { useId } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { OVERLAY_THEMES, THEME_DEFAULT_ACCENT, type OverlayAppearance, type OverlayThemeChoice } from "@/services/creator/overlayThemeTypes";
import s from "./themeChoice.module.css";
import { THEME_TEXT } from "./themeText";

/**
 * A widget's own theme (code-first, 2026-10-08): 전체 테마 따르기 or one of the three looks, as small swatch
 * chips. The 전체 테마 chip names the theme it currently means.
 */
export function ThemeChoiceField({ value, onChange, appearance }: { value: OverlayThemeChoice; onChange: (v: OverlayThemeChoice) => void; appearance: OverlayAppearance }) {
  const { t } = useI18n();
  const name = useId();
  const current = THEME_TEXT[appearance.theme] ? t(THEME_TEXT[appearance.theme].label) : "";
  const options: { key: OverlayThemeChoice; label: string; sub?: string; swatch: string }[] = [
    { key: "INHERIT", label: t("studioToolsTheme.inherit"), sub: current, swatch: appearance.theme },
    ...OVERLAY_THEMES.map((x) => ({ key: x.key, label: t(THEME_TEXT[x.key].label), swatch: x.key }))
  ];
  return (
    <div role="radiogroup" aria-label={t("studioToolsTheme.themeAria")} className={s.group}>
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
