"use client";

import { useEffect, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { getOverlayLook, saveOverlayLook } from "@/services/creator/overlayTheme";
import type { LookTarget, OverlayAppearance, OverlayThemeChoice } from "@/services/creator/overlayThemeTypes";
import s from "./lookPicker.module.css";
import { ThemeChoiceField } from "./ThemeChoiceField";

type State = { status: "LOADING" } | { status: "ERROR" } | { status: "READY"; theme: OverlayThemeChoice; appearance: OverlayAppearance };

/**
 * 오버레이 테마 for an overlay managed on its own screen (크루 점수판 · 영상 후원 · 그림후원; code-first, 2026-10-08).
 * Loads the current choice, saves as soon as one is picked; the overlay changes on its next read.
 */
export function OverlayLookPicker({ target }: { target: LookTarget }) {
  const { t } = useI18n();
  const [state, setState] = useState<State>({ status: "LOADING" });
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    getOverlayLook(target)
      .then((r) => alive && setState(r ? { status: "READY", ...r } : { status: "ERROR" }))
      .catch(() => alive && setState({ status: "ERROR" }));
    return () => {
      alive = false;
    };
  }, [target, attempt]);

  if (state.status === "LOADING") return <p className={s.note}>{t("studioToolsTheme.loading")}</p>;
  if (state.status === "ERROR")
    return (
      <p className={s.note}>
        {t("studioToolsTheme.loadFailed")}{" "}
        <button
          type="button"
          className={s.retry}
          onClick={() => {
            setState({ status: "LOADING" });
            setAttempt((n) => n + 1);
          }}
        >
          {t("studioTools.retry")}
        </button>
      </p>
    );

  const pick = (theme: OverlayThemeChoice) => {
    const before = state.theme;
    setState({ ...state, theme });
    setNote(null);
    startTransition(async () => {
      try {
        const res = await saveOverlayLook(target, theme);
        if (res.status === "SAVED") setNote({ tone: "ok", text: t("studioToolsTheme.lookSaved") });
        else {
          setState((cur) => (cur.status === "READY" ? { ...cur, theme: before } : cur));
          setNote({ tone: "error", text: res.status === "INVALID" ? res.message : t("studioToolsTheme.relogin") });
        }
      } catch {
        setState((cur) => (cur.status === "READY" ? { ...cur, theme: before } : cur));
        setNote({ tone: "error", text: t("studioTools.saveFailed") });
      }
    });
  };

  return (
    <div className={s.picker} aria-busy={pending || undefined}>
      <span className={s.label}>{t("studioToolsTheme.overlayTheme")}</span>
      <ThemeChoiceField value={state.theme} onChange={pick} appearance={state.appearance} />
      {note && (
        <p className={note.tone === "error" ? s.error : s.ok} role={note.tone === "error" ? "alert" : "status"}>
          {note.text}
        </p>
      )}
    </div>
  );
}
