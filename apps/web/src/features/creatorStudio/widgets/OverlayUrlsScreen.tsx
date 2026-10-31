"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { THEME_TEXT } from "@/features/overlayTheme/themeText";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { setOverlaySwitch } from "@/services/creator/alertRemote";
import type { OverlayTarget } from "@/services/creator/alertTypes";
import { THEME_DEFAULT_ACCENT, type OverlayAppearance } from "@/services/creator/overlayThemeTypes";
import styles from "../crew/crew.module.css";
import { CopyButton } from "../settings/SettingsCards";
import { obsFileName, obsSceneCollection, OBS_COLLECTION_NAME } from "./obsScenes";
import { overlayDescription, overlayGroup, overlaySize, overlayTitle } from "./overlayCatalogText";
import { OVERLAYS } from "@/services/creator/overlayCatalog";
import local from "./overlayUrls.module.css";

const mask = (key: string) => `${key.slice(0, 4)}-····-····-····`;

/**
 * 오버레이 주소 — code-first (no Figma frame). Route `/creator/widgets/overlays`. Lists every OBS
 * overlay with its recommended size; the key is masked on screen and only copied in full.
 * 후원 위젯 with an overlay (목표 · 누적 · 랭킹 · 최근알림 · 이벤트 · QR) are listed; the other widget popups
 * (미니후원, 커스텀 사운드 …) have no overlay of their own. Overlays switched OFF in
 * the 리모컨 기능 제어 are marked, with a one-click 켜기. "OBS 씬 파일 내려받기" saves every overlay as an OBS scene
 * collection (built in the browser; the file holds the key). The 오버레이 테마 line (2026-10-08) names the 전체 테마 every
 * overlay draws in unless its own settings picked another, and links to where it is chosen.
 */
export function OverlayUrlsScreen({ overlayKey, switches, appearance }: { overlayKey: string; switches: Record<OverlayTarget, boolean>; appearance: OverlayAppearance }) {
  const router = useRouter();
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const off = OVERLAYS.filter((o) => !switches[o.target]);
  const turnOn = (target: OverlayTarget) =>
    startTransition(async () => {
      setError(null);
      const res = await setOverlaySwitch({ target, on: true });
      if (res.status === "SAVED") router.refresh();
      else setError(res.status === "INVALID" ? res.message : t("studioToolsOverlays.relogin"));
    });
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const groups = [...new Set(OVERLAYS.map((o) => o.group))];
  const all = OVERLAYS.map((o) => `${overlayTitle(o, t)}\t${origin}${o.path(overlayKey)}`).join("\n");
  const downloadObs = () => {
    setError(null);
    try {
      const json = JSON.stringify(obsSceneCollection(OVERLAYS, window.location.origin, overlayKey), null, 2);
      const href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = href;
      a.download = obsFileName();
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
      setSaved(true);
    } catch {
      setError(t("studioToolsOverlays.fileFailed"));
    }
  };

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("studioToolsOverlays.title")}</h1>
        <p className={styles.subtitle}>{t("studioToolsOverlays.subtitle")}</p>
        <p className={styles.note}>
          <Link href="/creator/widgets">{t("studioTools.backWidgetAlerts")}</Link>
          {t("studioToolsOverlays.noteBefore")}
          <Link href="/creator/widgets/onesource">{t("studioToolsOverlays.noteLink")}</Link>
          {t("studioToolsOverlays.noteAfter")}
        </p>
      </header>
      <p className={local.themeLine}>
        <span className={local.themeDot} style={{ background: appearance.accent ?? THEME_DEFAULT_ACCENT[appearance.theme] }} aria-hidden="true" />
        {t("studioToolsOverlays.themeLabel")}
        <b>{THEME_TEXT[appearance.theme] ? t(THEME_TEXT[appearance.theme].label) : undefined}</b>
        {t("studioToolsOverlays.themeRest")}
        <Link href="/creator/widgets">{t("studioToolsOverlays.changeTheme")}</Link>
        {t("studioToolsOverlays.verticalNote")}
      </p>
      {off.length > 0 && (
        <p className={local.offSummary} role="status">
          {t("studioToolsOverlays.offBefore", { count: off.length, titles: off.map((o) => overlayTitle(o, t)).join(", ") })}
          <Link href="/creator/remote">{t("studioToolsOverlays.offLink")}</Link>
          {t("studioToolsOverlays.offAfter")}
        </p>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <CopyButton value={all} label={t("studioToolsOverlays.copyAll", { count: OVERLAYS.length })} className={styles.ghost} />
        <button type="button" className={styles.primary} onClick={downloadObs}>
          {t("studioToolsOverlays.downloadObs")}
        </button>
      </div>
      <section className={styles.card} aria-labelledby="obs-import">
        <h2 className={styles.cardTitle} id="obs-import">
          {t("studioToolsOverlays.importTitle")}
        </h2>
        <ol className={local.steps}>
          <li>{t("studioToolsOverlays.step1")}</li>
          <li>{t("studioToolsOverlays.step2")}</li>
          <li>{t("studioToolsOverlays.step3", { collection: OBS_COLLECTION_NAME, count: OVERLAYS.length, groups: groups.length })}</li>
        </ol>
        <p className={styles.note}>{t("studioToolsOverlays.fileNote")}</p>
        {saved && (
          <p className={styles.ok} role="status">
            {t("studioToolsOverlays.downloaded")}
          </p>
        )}
      </section>
      {groups.map((g) => (
        <section key={g} className={styles.card} aria-label={overlayGroup(g, t)}>
          <h2 className={styles.cardTitle}>{overlayGroup(g, t)}</h2>
          <ul className={styles.list}>
            {OVERLAYS.filter((o) => o.group === g).map((o) => {
              const url = `${origin}${o.path(overlayKey)}`;
              return (
                <li key={o.id} className={styles.row} data-off={switches[o.target] ? undefined : ""}>
                  <div className={`${styles.rowMain} ${local.main}`}>
                    <span className={styles.rowTitle}>
                      {overlayTitle(o, t)} <span className={local.size}>OBS {overlaySize(o, t)}</span>
                      {!switches[o.target] && <span className={local.off}>OFF</span>}
                    </span>
                    <span className={styles.muted}>{switches[o.target] ? overlayDescription(o, t) : t("studioToolsOverlays.offDescription")}</span>
                    <code className={local.url}>{`${origin}${o.path(mask(overlayKey))}`}</code>
                  </div>
                  <div className={styles.rowActions}>
                    {!switches[o.target] && (
                      <button type="button" className={styles.primary} disabled={pending} onClick={() => turnOn(o.target)}>
                        {t("studioToolsOverlays.turnOn")}
                      </button>
                    )}
                    <Link href={o.manage} className={styles.ghost}>
                      {t("studioTools.settings")}
                    </Link>
                    <Link href={`/creator/widgets/overlays/preview/${o.id}`} className={styles.ghost}>
                      {t("studioTools.preview")}
                    </Link>
                    <CopyButton value={url} label={t("studioTools.copy")} className={styles.ghost} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
