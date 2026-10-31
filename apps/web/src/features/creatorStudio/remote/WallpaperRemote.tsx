"use client";

import Link from "next/link";
import { useState } from "react";
import { formatKstTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { RemoteResult } from "@/services/creator/alertTypes";
import { clearWallpaper, type WallpaperRemoteView } from "@/services/creator/wallpaperRemote";
import styles from "../crew/crew.module.css";
import remote from "./remote.module.css";

const time = (iso: string) => formatKstTime(iso, { hour: "2-digit", minute: "2-digit" });

/**
 * 리모컨 "벽지" card — code-first (2026-10-04 결정: 자동 배치 스티커 벽). Every donation sticks a sticker on
 * the 벽지 overlay until the wall is full (then the oldest gives its spot up); 벽지 비우기 starts a new wall.
 * The donations stay in the 후원 내역 — only the screen is cleared.
 */
export function WallpaperRemote({
  view,
  pending,
  run
}: {
  view: WallpaperRemoteView;
  pending: boolean;
  run: (action: () => Promise<RemoteResult>, ok?: string, after?: () => void) => void;
}) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  return (
    <section className={styles.card} aria-labelledby="wallpaper-remote">
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle} id="wallpaper-remote">
          {t("studioRemote.wallpaperTitle")}
        </h2>
        <Link href="/creator/widgets?open=WALLPAPER" className={styles.ghost}>
          {t("studioRemote.wallpaperSettings")}
        </Link>
      </div>
      <p className={styles.note}>{t("studioRemote.wallpaperNote")}</p>
      <div className={remote.status}>
        <span>{t("studioRemote.wallpaperCount", { count: view.stickers, slots: view.slots })}</span>
        {view.clearedAt && <span className={styles.muted}>{t("studioRemote.wallpaperSince", { time: time(view.clearedAt) })}</span>}
      </div>
      {view.stickers === 0 && <p className={styles.empty}>{t("studioRemote.wallpaperEmpty")}</p>}
      {confirming ? (
        <div className={remote.buttons} role="group" aria-label={t("studioRemote.wallpaperConfirmAria")}>
          <span className={styles.muted}>{t("studioRemote.wallpaperConfirm")}</span>
          <button
            type="button"
            className={styles.danger}
            disabled={pending}
            onClick={() => run(() => clearWallpaper(), t("studioRemote.wallpaperCleared"), () => setConfirming(false))}
          >
            {t("studioRemote.wallpaperClearNow")}
          </button>
          <button type="button" className={styles.ghost} disabled={pending} onClick={() => setConfirming(false)}>
            {t("studioRemote.cancel")}
          </button>
        </div>
      ) : (
        <div className={remote.buttons}>
          <button type="button" className={styles.ghost} disabled={pending || view.stickers === 0} onClick={() => setConfirming(true)}>
            {t("studioRemote.wallpaperClear")}
          </button>
        </div>
      )}
    </section>
  );
}
