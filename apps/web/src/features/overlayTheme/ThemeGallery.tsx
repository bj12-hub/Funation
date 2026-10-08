"use client";

import { useId, useRef, useState, useTransition } from "react";
import { saveOverlayAppearance } from "@/services/creator/overlayTheme";
import { ACCENT_PRESETS, OVERLAY_THEMES, isHex6, resolveTheme, type OverlayAppearance, type OverlayTheme } from "@/services/creator/overlayThemeTypes";
import { ColorField } from "../creatorStudio/widgets/fields";
import g from "./themeGallery.module.css";
import { ThemeSample } from "./ThemeSample";

/**
 * 오버레이 테마 (code-first, 2026-10-08): the channel's 전체 테마 for every OBS overlay, picked from three sample
 * scenes, plus one 포인트 색상. Widgets can still choose their own theme in their settings.
 */
export function ThemeGallery({ initial }: { initial: OverlayAppearance }) {
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
          setNote({ tone: "ok", text: "테마를 저장했어요. 열려 있는 오버레이에 몇 초 안에 반영돼요." });
        } else setNote({ tone: "error", text: res.status === "INVALID" ? res.message : "로그인이 필요합니다. 다시 로그인해 주세요." });
      } catch {
        setNote({ tone: "error", text: "저장하지 못했어요. 잠시 후 다시 시도해 주세요." });
      } finally {
        busy.current = false;
      }
    });
  };

  return (
    <section className={g.section} aria-labelledby={`${name}-title`}>
      <div className={g.head}>
        <h2 id={`${name}-title`} className={g.title}>
          오버레이 테마
        </h2>
        <p className={g.subtitle}>모든 오버레이에 같은 디자인을 입혀요. 위젯마다 설정에서 다른 테마를 고를 수도 있어요.</p>
      </div>

      <div role="radiogroup" aria-label="오버레이 테마" className={g.grid}>
        {OVERLAY_THEMES.map((t) => (
          <label key={t.key} className={g.option} data-checked={theme === t.key || undefined}>
            <input type="radio" name={`${name}-theme`} className={g.srOnly} checked={theme === t.key} onChange={() => setTheme(t.key)} aria-label={t.label} />
            <ThemeSample theme={resolveTheme({ theme: t.key, accent: accentValid ? accent : null })} />
            <span className={g.optionText}>
              <strong>
                {t.label}
                {saved.theme === t.key && <span className={g.badge}>사용 중</span>}
              </strong>
              <span>{t.summary}</span>
              <span className={g.mood}>{t.mood}</span>
            </span>
          </label>
        ))}
      </div>

      <div className={g.accentRow}>
        <span className={g.accentLabel} id={`${name}-accent`}>
          포인트 색상
        </span>
        <div role="radiogroup" aria-labelledby={`${name}-accent`} className={g.swatches}>
          <label className={g.swatchDefault} data-checked={accent === null || undefined}>
            <input type="radio" name={`${name}-accent`} className={g.srOnly} checked={accent === null} onChange={() => setAccent(null)} aria-label="테마 기본 색" />
            테마 기본
          </label>
          {ACCENT_PRESETS.map((c) => (
            <label key={c} className={g.swatch} data-checked={accent === c || undefined} style={{ background: c }} title={c}>
              <input type="radio" name={`${name}-accent`} className={g.srOnly} checked={accent === c} onChange={() => setAccent(c)} aria-label={`포인트 색상 ${c}`} />
            </label>
          ))}
          <label className={g.customToggle} data-checked={(accent !== null && !(ACCENT_PRESETS as readonly string[]).includes(accent)) || undefined}>
            <input
              type="radio"
              name={`${name}-accent`}
              className={g.srOnly}
              checked={accent !== null && !(ACCENT_PRESETS as readonly string[]).includes(accent)}
              onChange={() => setAccent(custom)}
              aria-label="포인트 색상 직접 고르기"
            />
            직접 고르기
          </label>
          {accent !== null && !(ACCENT_PRESETS as readonly string[]).includes(accent) && (
            <ColorField
              label="포인트 색상 직접 입력"
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
            포인트 색상은 #RRGGBB 형식으로 입력해 주세요.
          </p>
        )}
        <button type="button" className={g.save} onClick={save} disabled={!dirty || !accentValid || pending}>
          {pending ? "저장 중…" : "테마 저장"}
        </button>
      </div>
    </section>
  );
}
