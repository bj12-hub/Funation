"use client";

import { OverlayLookPicker } from "@/features/overlayTheme/OverlayLookPicker";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { addTestDrawing, deleteDrawing, saveDrawingSettings, setDrawingShowing } from "@/services/creator/media";
import { MEDIA_LIMITS, type DrawingView, type MediaResult } from "@/services/creator/mediaTypes";
import type { OverlayTarget } from "@/services/creator/alertTypes";
import styles from "../../crew/crew.module.css";
import { OverlayOffNotice } from "../../remote/OverlayOffNotice";
import { CopyButton } from "../../settings/SettingsCards";
import local from "./media.module.css";

/**
 * 그림후원 위젯 — code-first (no Figma frame). Route `/creator/widgets/drawing`.
 * Drawings go on the OBS drawing overlay one after another for the 전시 시간 each (2026-10-07 결정: 대기열);
 * the creator can show any drawing now, or take the current one down so the next goes up.
 */
export function DrawingScreen({ view, overlayPath, switches }: { view: DrawingView; overlayPath: string; switches: Record<OverlayTarget, boolean> }) {
  const router = useRouter();
  const { t } = useI18n();
  const [displaySec, setDisplaySec] = useState(view.settings.displaySec);
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [origin, setOrigin] = useState("");
  const requestId = useRef<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
    const poll = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(poll);
  }, [router]);

  const run = (action: () => Promise<MediaResult>, okText: string, after?: () => void) => {
    setNote(null);
    startTransition(async () => {
      try {
        const res = await action();
        if (res.status === "OK") {
          setNote({ tone: "ok", text: okText });
          after?.();
          router.refresh();
        } else setNote({ tone: "error", text: res.status === "INVALID" ? res.message : t("studioTools.loginRequired") });
      } catch {
        setNote({ tone: "error", text: t("studioTools.processFailed") });
      }
    });
  };
  const sendTest = () => {
    requestId.current ??= crypto.randomUUID();
    run(
      () => addTestDrawing({ requestId: requestId.current }),
      view.showing ? t("studioToolsMedia.testDrawingQueued") : t("studioToolsMedia.testDrawingShown"),
      () => (requestId.current = null)
    );
  };

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("studioToolsMedia.drawingTitle")}</h1>
        <p className={styles.subtitle}>{t("studioToolsMedia.drawingSubtitle")}</p>
        <p className={styles.note}>
          <Link href="/creator/widgets">{t("studioTools.backWidgets")}</Link>
        </p>
      </header>
      <OverlayOffNotice targets={["drawing"]} switches={switches} />

      <section className={styles.card} aria-labelledby="drw-overlay">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="drw-overlay">
            {t("studioToolsMedia.drawingOverlayTitle")}
          </h2>
          <CopyButton value={`${origin}${overlayPath}`} label={t("studioTools.copyOverlayUrl")} className={styles.ghost} />
        </div>
        <p className={styles.note}>{t("studioToolsMedia.drawingOverlayNote")}</p>
        <OverlayLookPicker target="drawing" />
        <div className={styles.addRow}>
          <span className={styles.muted}>{t("studioToolsMedia.displayTime")}</span>
          <input
            className={styles.inputSmall}
            type="number"
            aria-label={t("studioToolsMedia.displayTimeAria")}
            min={MEDIA_LIMITS.displaySecMin}
            max={MEDIA_LIMITS.displaySecMax}
            value={displaySec}
            onChange={(e) => setDisplaySec(Math.floor(Number(e.target.value) || 0))}
          />
          <span className={styles.muted}>{t("studioTools.sec")}</span>
          <button type="button" className={styles.primary} disabled={pending} onClick={() => run(() => saveDrawingSettings({ displaySec }), t("studioToolsMedia.settingsSaved"))}>
            {t("studioTools.save")}
          </button>
          <button type="button" className={styles.ghost} disabled={pending} onClick={sendTest}>
            {t("studioToolsMedia.testDrawing")}
          </button>
          {view.showing && (
            <button
              type="button"
              className={styles.danger}
              disabled={pending}
              onClick={() => run(() => setDrawingShowing({ id: null }), view.queue.length ? t("studioToolsMedia.downNext") : t("studioToolsMedia.down"))}
            >
              {view.queue.length ? t("studioToolsMedia.downNextButton") : t("studioToolsMedia.downButton")}
            </button>
          )}
        </div>
      </section>

      <section className={styles.card} aria-labelledby="drw-list">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="drw-list">
            {t("studioToolsMedia.received", { count: view.drawings.length })}
          </h2>
          {view.queue.length > 0 && <span className={styles.muted}>{t("studioToolsMedia.waitingCount", { count: view.queue.length })}</span>}
        </div>
        {view.drawings.length === 0 ? (
          <p className={styles.empty}>{t("studioToolsMedia.drawingEmpty")}</p>
        ) : (
          <ul className={local.gallery}>
            {view.drawings.map((d) => (
              <li key={d.id} className={local.drawing} data-showing={view.showing?.id === d.id ? "" : undefined}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.image} alt={d.title} />
                <div className={local.drawingInfo}>
                  <strong>{d.title}</strong>
                  <span className={styles.muted}>
                    {d.kind === "TEST" ? t("studioToolsMedia.testRequest") : `${d.donor} · ${formatNumber(d.fnAmount)} FN`}
                    {view.showing?.id === d.id ? t("studioToolsMedia.onDisplay") : ""}
                    {view.queue.includes(d.id) ? t("studioToolsMedia.queuePosition", { n: view.queue.indexOf(d.id) + 1 }) : ""}
                  </span>
                </div>
                <div className={styles.rowActions}>
                  <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => setDrawingShowing({ id: d.id }), t("studioToolsMedia.redisplayed"))}>
                    {t("studioToolsMedia.display")}
                  </button>
                  <button
                    type="button"
                    className={styles.danger}
                    disabled={pending}
                    onClick={() => window.confirm(t("studioToolsMedia.deleteConfirm", { title: d.title })) && run(() => deleteDrawing(d.id), t("studioToolsMedia.drawingDeleted"))}
                  >
                    {t("studioTools.delete")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.note}>{t("studioToolsMedia.keepNote", { max: MEDIA_LIMITS.drawingsMax })}</p>
      </section>

      {note && (
        <p className={note.tone === "error" ? styles.error : styles.ok} role={note.tone === "error" ? "alert" : "status"}>
          {note.text}
        </p>
      )}
    </div>
  );
}
