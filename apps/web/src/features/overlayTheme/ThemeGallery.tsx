"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { saveOverlayAppearance } from "@/services/creator/overlayTheme";
import { ACCENT_PRESETS, OVERLAY_THEMES, isHex6, resolveTheme, type OverlayAppearance, type OverlayTheme } from "@/services/creator/overlayThemeTypes";
import { ColorField } from "../creatorStudio/widgets/fields";
import g from "./themeGallery.module.css";
import { ThemeSample } from "./ThemeSample";
import { THEME_TEXT } from "./themeText";

/**
 * 오버레이 테마 (code-first, 2026-10-08): the channel's 전체 테마 for every OBS overlay, picked from three sample
 * scenes, plus one 포인트 색상. Widgets can still choose their own theme in their settings.
 */
export function ThemeGallery({ initial }: { initial: OverlayAppearance }) {
  const { t } = useI18n();
  const [saved, setSaved] = useState(initial);
  const [theme, setTheme] = useState<OverlayTheme>(initial.theme);
  const [accent, setAccent] = useState<string | null>(initial.accent);
  const [custom, setCustom] = useState(initial.accent && !(ACCENT_PRESETS as readonly string[]).includes(initial.accent) ? initial.accent : "#8B5CF6");
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  const name = useId();
  const dirty = theme !== saved.theme || accent !== saved.accent;
  const accentValid = accent === null || isHex6(accent);

  const save = () => {
    if (busy.current || !dirty || !accentValid) return;
    busy.current = true;
    setNote(null);
    const next = { theme, accent };
    startTransition(async () => {
      try {
        const res = await saveOverlayAppearance(next);
        if (res.status === "SAVED") {
          setSaved(next);
          setNote({ tone: "ok", text: t("studioToolsTheme.gallerySaved") });
        } else setNote({ tone: "error", text: res.status === "INVALID" ? res.message : t("studioToolsTheme.relogin") });
      } catch {
        setNote({ tone: "error", text: t("studioTools.saveFailed") });
      } finally {
        busy.current = false;
      }
    });
  };

  return (
    <section className={g.section} aria-labelledby={`${name}-title`}>
      <div className={g.head}>
        <h2 id={`${name}-title`} className={g.title}>
          {t("studioToolsTheme.overlayTheme")}
        </h2>
        <p className={g.subtitle}>{t("studioToolsTheme.gallerySubtitle")}</p>
      </div>

      <div role="radiogroup" aria-label={t("studioToolsTheme.overlayTheme")} className={g.grid}>
        {OVERLAY_THEMES.map((x) => (
          <label key={x.key} className={g.option} data-checked={theme === x.key || undefined}>
            <input type="radio" name={`${name}-theme`} className={g.srOnly} checked={theme === x.key} onChange={() => setTheme(x.key)} aria-label={t(THEME_TEXT[x.key].label)} />
            <ThemeSample theme={resolveTheme({ theme: x.key, accent: accentValid ? accent : null })} />
            <span className={g.optionText}>
              <strong>
                {t(THEME_TEXT[x.key].label)}
                {saved.theme === x.key && <span className={g.badge}>{t("studioToolsTheme.inUse")}</span>}
              </strong>
              <span>{t(THEME_TEXT[x.key].summary)}</span>
              <span className={g.mood}>{t(THEME_TEXT[x.key].mood)}</span>
            </span>
          </label>
        ))}
      </div>

      <div className={g.accentRow}>
        <span className={g.accentLabel} id={`${name}-accent`}>
          {t("studioToolsTheme.accent")}
        </span>
        <div role="radiogroup" aria-labelledby={`${name}-accent`} className={g.swatches}>
          <label className={g.swatchDefault} data-checked={accent === null || undefined}>
            <input type="radio" name={`${name}-accent`} className={g.srOnly} checked={accent === null} onChange={() => setAccent(null)} aria-label={t("studioToolsTheme.accentDefaultAria")} />
            {t("studioToolsTheme.accentDefault")}
          </label>
          {ACCENT_PRESETS.map((c) => (
            <label key={c} className={g.swatch} data-checked={accent === c || undefined} style={{ background: c }} title={c}>
              <input type="radio" name={`${name}-accent`} className={g.srOnly} checked={accent === c} onChange={() => setAccent(c)} aria-label={t("studioToolsTheme.accentAria", { color: c })} />
            </label>
          ))}
          <label className={g.customToggle} data-checked={(accent !== null && !(ACCENT_PRESETS as readonly string[]).includes(accent)) || undefined}>
            <input
              type="radio"
              name={`${name}-accent`}
              className={g.srOnly}
              checked={accent !== null && !(ACCENT_PRESETS as readonly string[]).includes(accent)}
              onChange={() => setAccent(custom)}
              aria-label={t("studioToolsTheme.accentCustomAria")}
            />
            {t("studioToolsTheme.accentCustom")}
          </label>
          {accent !== null && !(ACCENT_PRESETS as readonly string[]).includes(accent) && (
            <ColorField
              label={t("studioToolsTheme.accentInput")}
              value={custom}
              width={150}
              onChange={(v) => {
                setCustom(v);
                setAccent(v);
              }}
            />
          )}
        </div>
      </div>

      <div className={g.actions}>
        {note && (
          <p className={note.tone === "error" ? g.error : g.ok} role={note.tone === "error" ? "alert" : "status"}>
            {note.text}
          </p>
        )}
        {!accentValid && (
          <p className={g.error} role="alert">
            {t("studioToolsTheme.accentInvalid")}
          </p>
        )}
        <button type="button" className={g.save} onClick={save} disabled={!dirty || !accentValid || pending}>
          {pending ? t("studioTools.saving") : t("studioToolsTheme.saveTheme")}
        </button>
      </div>
    </section>
  );
}
