"use client";

import { useEffect, useState, useTransition } from "react";
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

  if (state.status === "LOADING") return <p className={s.note}>테마를 불러오는 중…</p>;
  if (state.status === "ERROR")
    return (
      <p className={s.note}>
        테마를 불러오지 못했어요.{" "}
        <button
          type="button"
          className={s.retry}
          onClick={() => {
            setState({ status: "LOADING" });
            setAttempt((n) => n + 1);
          }}
        >
          다시 시도
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
        if (res.status === "SAVED") setNote({ tone: "ok", text: "테마를 바꿨어요. 오버레이에 몇 초 안에 반영돼요." });
        else {
          setState((cur) => (cur.status === "READY" ? { ...cur, theme: before } : cur));
          setNote({ tone: "error", text: res.status === "INVALID" ? res.message : "로그인이 필요합니다. 다시 로그인해 주세요." });
        }
      } catch {
        setState((cur) => (cur.status === "READY" ? { ...cur, theme: before } : cur));
        setNote({ tone: "error", text: "저장하지 못했어요. 잠시 후 다시 시도해 주세요." });
      }
    });
  };

  return (
    <div className={s.picker} aria-busy={pending || undefined}>
      <span className={s.label}>오버레이 테마</span>
      <ThemeChoiceField value={state.theme} onChange={pick} appearance={state.appearance} />
      {note && (
        <p className={note.tone === "error" ? s.error : s.ok} role={note.tone === "error" ? "alert" : "status"}>
          {note.text}
        </p>
      )}
    </div>
  );
}
