"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { sendTestAlert } from "@/services/creator/alertRemote";
import styles from "../crew/crew.module.css";
import local from "./overlayPreview.module.css";

const BACKGROUNDS = [
  { key: "checker", label: "studioToolsOverlays.bgChecker" },
  { key: "dark", label: "studioToolsOverlays.bgDark" },
  { key: "light", label: "studioToolsOverlays.bgLight" }
] as const;
type Background = (typeof BACKGROUNDS)[number]["key"];

export type OverlayPreviewProps = {
  title: string;
  description: string;
  /** "800 × 600" — the recommended OBS source size the frame is drawn at. */
  size: string;
  /** Overlay path with the real key (creator-only page; never shown as text). */
  src: string;
  manage: string;
  on: boolean;
  /** Overlays that react to a 테스트 후원 (alerts, effects, 벽지). */
  testable: boolean;
};

/**
 * 오버레이 미리보기 — code-first (funnation `preview=true`, 2026-10-06 결정). Overlays are transparent pages, so
 * opening one in a tab shows nothing useful; this draws it at its OBS size, scaled to fit, on a chosen backdrop,
 * and can send a display-only 테스트 후원 to see an alert arrive.
 */
export function OverlayPreview({ title, description, size, src, manage, on, testable }: OverlayPreviewProps) {
  const { t } = useI18n();
  const [bg, setBg] = useState<Background>("checker");
  const [scale, setScale] = useState(1);
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [reload, setReload] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const [w, h] = (size.match(/(\d+)\s*×\s*(\d+)/)?.slice(1).map(Number) ?? [1920, 1080]) as [number, number];

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / w));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w]);

  const test = () => {
    setNote(null);
    startTransition(async () => {
      try {
        const res = await sendTestAlert({ requestId: crypto.randomUUID(), amount: 10_000, donor: "미리보기", message: "오버레이 미리보기 테스트예요" });
        setNote(
          res.status === "SAVED"
            ? { tone: "ok", text: t("studioToolsOverlays.testSent") }
            : { tone: "error", text: res.status === "INVALID" ? res.message : t("studioTools.loginRequired") }
        );
      } catch {
        setNote({ tone: "error", text: t("studioToolsOverlays.sendFailed") });
      }
    });
  };

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("studioToolsOverlays.previewTitle", { title })}</h1>
        <p className={styles.subtitle}>{t("studioToolsOverlays.previewSubtitle", { description, size })}</p>
        <p className={styles.note}>
          <Link href="/creator/widgets/overlays">{t("studioToolsOverlays.backOverlays")}</Link>
        </p>
      </header>

      {!on && (
        <p className={styles.note} role="status">
          {t("studioToolsOverlays.offNoteBefore")}
          <Link href="/creator/remote">{t("studioTools.remote")}</Link>
          {t("studioToolsOverlays.offNoteAfter")}
        </p>
      )}

      <div className={local.toolbar}>
        <div className={`${styles.tabs} ${local.backgrounds}`} role="radiogroup" aria-label={t("studioToolsOverlays.bgAria")}>
          {BACKGROUNDS.map((b) => (
            <button key={b.key} type="button" role="radio" aria-checked={bg === b.key} className={styles.tab} onClick={() => setBg(b.key)}>
              {t(b.label)}
            </button>
          ))}
        </div>
        <div className={styles.rowActions}>
          {testable && (
            <button type="button" className={styles.primary} disabled={pending} onClick={test}>
              {pending ? t("studioTools.sending") : t("studioToolsOverlays.sendTest")}
            </button>
          )}
          <button type="button" className={styles.ghost} onClick={() => setReload((n) => n + 1)}>
            {t("studioToolsOverlays.reload")}
          </button>
          <a href={src} target="_blank" rel="noopener noreferrer" className={styles.ghost}>
            {t("studioToolsOverlays.openTab")}
          </a>
          <Link href={manage} className={styles.ghost}>
            {t("studioTools.settings")}
          </Link>
        </div>
      </div>

      {note && (
        <p className={note.tone === "error" ? styles.error : styles.ok} role={note.tone === "error" ? "alert" : "status"}>
          {note.text}
        </p>
      )}

      {/* The wrapper measures the room; the canvas is the overlay's OBS size times the fitted scale. */}
      <div ref={stage} className={local.fit}>
        <div className={local.stage} data-bg={bg} style={{ width: Math.round(w * scale), height: Math.round(h * scale) }}>
          <iframe
            key={reload}
            src={src}
            title={t("studioToolsOverlays.frameTitle", { title })}
            className={local.frame}
            style={{ width: w, height: h, transform: `scale(${scale})` }}
          />
        </div>
      </div>
      <p className={styles.note}>{t("studioToolsOverlays.scaleNote", { percent: Math.round(scale * 100) })}</p>
    </div>
  );
}
