"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { saveBannerSettings } from "@/services/creator/banner";
import { BANNER_LIMITS, BANNER_POSITIONS, type BannerPosition, type BannerSettings } from "@/services/creator/bannerTypes";
import type { Asset } from "@/services/creator/assetTypes";
import type { OverlayTarget } from "@/services/creator/alertTypes";
import styles from "../../crew/crew.module.css";
import { OverlayOffNotice } from "../../remote/OverlayOffNotice";
import { CopyButton } from "../../settings/SettingsCards";
import local from "./library.module.css";

/** Position labels by key (the service's BANNER_POSITIONS stay as written, 2026-11-01). */
const POSITION_KEY: Record<BannerPosition, MessageKey> = { TOP: "studioToolsLibrary.positionTop", CENTER: "studioToolsLibrary.positionCenter", BOTTOM: "studioToolsLibrary.positionBottom" };

/**
 * 배너 위젯 — code-first (no Figma frame). Route `/creator/widgets/banner`.
 * Pick library images as slides; the OBS banner overlay cycles them at the chosen position.
 */
export function BannerScreen({ initial, library, overlayPath, switches }: { initial: BannerSettings; library: Asset[]; overlayPath: string; switches: Record<OverlayTarget, boolean> }) {
  const { t } = useI18n();
  const [s, setS] = useState<BannerSettings>(initial);
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const byId = new Map(library.map((a) => [a.id, a]));
  const toggle = (id: string) =>
    setS((p) => (p.slides.includes(id) ? { ...p, slides: p.slides.filter((x) => x !== id) } : p.slides.length >= BANNER_LIMITS.slidesMax ? p : { ...p, slides: [...p.slides, id] }));
  const move = (i: number, d: -1 | 1) =>
    setS((p) => {
      const slides = [...p.slides];
      [slides[i], slides[i + d]] = [slides[i + d], slides[i]];
      return { ...p, slides };
    });

  const save = () => {
    setNote(null);
    startTransition(async () => {
      try {
        const res = await saveBannerSettings(s);
        setNote(
          res.status === "SAVED"
            ? { tone: "ok", text: t("studioToolsLibrary.bannerSaved") }
            : { tone: "error", text: res.status === "INVALID" ? res.message : t("studioTools.loginRequired") }
        );
      } catch {
        setNote({ tone: "error", text: t("studioTools.saveFailed") });
      }
    });
  };

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("studioToolsLibrary.bannerTitle")}</h1>
        <p className={styles.subtitle}>{t("studioToolsLibrary.bannerSubtitle")}</p>
        <p className={styles.note}>
          <Link href="/creator/widgets">{t("studioTools.backWidgets")}</Link>
          {t("studioToolsLibrary.bannerHeadBefore")}
          <Link href="/creator/widgets/assets">{t("studioTools.assetsLink")}</Link>
          {t("studioToolsLibrary.bannerHeadMiddle")}
          <Link href="/creator/widgets/banner/ai">{t("studioToolsLibrary.aiBannerLink")}</Link>
          {t("studioToolsLibrary.bannerHeadAfter")}
        </p>
      </header>
      <OverlayOffNotice targets={["banner"]} switches={switches} />

      <section className={styles.card} aria-labelledby="bn-overlay">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="bn-overlay">
            {t("studioToolsLibrary.bannerOverlayTitle")}
          </h2>
          <CopyButton value={`${origin}${overlayPath}`} label={t("studioTools.copyOverlayUrl")} className={styles.ghost} />
        </div>
        <p className={styles.note}>{t("studioToolsLibrary.bannerOverlayNote")}</p>
      </section>

      <section className={styles.card} aria-labelledby="bn-settings">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="bn-settings">
            {t("studioToolsLibrary.settingsTitle")}
          </h2>
          <label className={styles.checkRow}>
            <input type="checkbox" checked={s.enabled} onChange={(e) => setS({ ...s, enabled: e.target.checked })} />
            {t("studioTools.on")}
          </label>
        </div>
        <div className={styles.addRow}>
          <select className={styles.select} aria-label={t("studioToolsLibrary.position")} value={s.position} onChange={(e) => setS({ ...s, position: e.target.value as BannerPosition })}>
            {BANNER_POSITIONS.map((p) => (
              <option key={p.key} value={p.key}>
                {t(POSITION_KEY[p.key])}
              </option>
            ))}
          </select>
          <input
            className={styles.inputSmall}
            type="number"
            aria-label={t("studioToolsLibrary.intervalAria")}
            min={BANNER_LIMITS.intervalMin}
            max={BANNER_LIMITS.intervalMax}
            value={s.intervalSec}
            onChange={(e) => setS({ ...s, intervalSec: Math.floor(Number(e.target.value) || 0) })}
          />
          <span className={styles.muted}>{t("studioToolsLibrary.intervalUnit")}</span>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="bn-slides">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="bn-slides">
            {t("studioToolsLibrary.slides", { count: s.slides.length, max: BANNER_LIMITS.slidesMax })}
          </h2>
        </div>
        {s.slides.length === 0 ? (
          <p className={styles.empty}>{t("studioToolsLibrary.slidesEmpty")}</p>
        ) : (
          <ol className={styles.list}>
            {s.slides.map((id, i) => {
              const a = byId.get(id);
              return (
                <li key={id} className={styles.row}>
                  <span className={styles.muted}>{i + 1}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {a && <img className={local.slideThumb} src={a.url} alt="" />}
                  <span className={styles.rowMain}>{a?.name ?? t("studioToolsLibrary.deletedImage")}</span>
                  <div className={styles.rowActions}>
                    <button type="button" className={styles.ghost} aria-label={t("studioToolsLibrary.upAria", { n: i + 1 })} disabled={i === 0} onClick={() => move(i, -1)}>
                      ↑
                    </button>
                    <button
                      type="button"
                      className={styles.ghost}
                      aria-label={t("studioToolsLibrary.downAria", { n: i + 1 })}
                      disabled={i === s.slides.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      ↓
                    </button>
                    <button type="button" className={styles.danger} onClick={() => toggle(id)}>
                      {t("studioTools.remove")}
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        <h3 className={local.subhead}>{t("studioToolsLibrary.libraryImages")}</h3>
        {library.length === 0 ? (
          <p className={styles.empty}>
            {t("studioToolsLibrary.noImagesBefore")}
            <Link href="/creator/widgets/assets">{t("studioTools.assetsLink")}</Link>
            {t("studioToolsLibrary.uploadFirstAfter")}
          </p>
        ) : (
          <div className={local.picker} role="group" aria-label={t("studioToolsLibrary.slidesPickAria")}>
            {library.map((a) => (
              <button key={a.id} type="button" className={local.pick} aria-pressed={s.slides.includes(a.id)} aria-label={a.name} onClick={() => toggle(a.id)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt="" />
              </button>
            ))}
          </div>
        )}
      </section>

      {note && (
        <p className={note.tone === "error" ? styles.error : styles.ok} role={note.tone === "error" ? "alert" : "status"}>
          {note.text}
        </p>
      )}
      <div className={styles.actions}>
        <button type="button" className={styles.primary} disabled={pending} onClick={save}>
          {pending ? t("studioTools.saving") : t("studioTools.saveSettings")}
        </button>
      </div>
    </div>
  );
}
