"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { REMOTE_WINDOW_PATH, openRemoteWindow } from "@/features/creatorStudio/remote/remoteWindow";
import { CopyButton } from "@/features/creatorStudio/settings/SettingsCards";
import styles from "./helper.module.css";

const CAN_DO: { emoji: string; title: MessageKey; text: MessageKey }[] = [
  { emoji: "🔔", title: "helper.canAlertsTitle", text: "helper.canAlertsText" },
  { emoji: "🔊", title: "helper.canVolumeTitle", text: "helper.canVolumeText" },
  { emoji: "🧪", title: "helper.canTestTitle", text: "helper.canTestText" },
  { emoji: "🎚️", title: "helper.canSwitchTitle", text: "helper.canSwitchText" },
  { emoji: "🎲", title: "helper.canGamesTitle", text: "helper.canGamesText" }
];

/** 라이브 방송 리모컨 가이드 — code-first (no Figma frame), after the legacy FlexTV 도우미 guide page. */
export function RemoteGuide() {
  const { t } = useI18n();
  const [origin, setOrigin] = useState("");
  const [blocked, setBlocked] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);
  const address = `${origin}${REMOTE_WINDOW_PATH}`;

  return (
    <div className={styles.content}>
      <header className={styles.pageHeader}>
        <h1>{t("helper.guideTitle")}</h1>
        <p>{t("helper.guideIntro")}</p>
      </header>

      <section className={styles.section} aria-labelledby="guide-can">
        <h2 id="guide-can" className={styles.sectionTitle}>
          {t("helper.guideCanTitle")}
        </h2>
        <ul className={styles.cards}>
          {CAN_DO.map((c) => (
            <li key={c.title} className={styles.card}>
              <span className={styles.cardEmoji} aria-hidden="true">
                {c.emoji}
              </span>
              <span className={styles.cardText}>
                <strong>{t(c.title)}</strong>
                <span>{t(c.text)}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="guide-open">
        <h2 id="guide-open" className={styles.sectionTitle}>
          {t("helper.guideOpenTitle")}
        </h2>
        <div className={styles.addressBox}>
          <span className={styles.addressLabel}>{t("helper.remoteAddress")}</span>
          <div className={styles.addressRow}>
            <input className={styles.addressField} value={address} readOnly aria-label={t("helper.remoteAddress")} onFocus={(e) => e.target.select()} />
            <CopyButton value={address} label={t("helper.copyAddress")} className={styles.stepLink} />
          </div>
        </div>
        <ol className={styles.steps}>
          <li className={styles.step}>
            <strong>{t("helper.openSmallTitle")}</strong>
            <p>{t("helper.openSmallText")}</p>
            <button type="button" className={styles.stepLink} onClick={() => setBlocked(!openRemoteWindow())}>
              {t("helper.openRemote")}
            </button>
            {blocked && (
              <p role="alert">
                {t("helper.blockedBefore")}
                <Link href="/remote">{t("helper.openHere")}</Link>
                {t("helper.blockedAfter")}
              </p>
            )}
          </li>
          <li className={styles.step}>
            <strong>{t("helper.obsTitle")}</strong>
            <p>{t("helper.obsText")}</p>
          </li>
          <li className={styles.step}>
            <strong>{t("helper.phoneTitle")}</strong>
            <p>{t("helper.phoneText")}</p>
          </li>
        </ol>
      </section>

      <section className={styles.section} aria-labelledby="guide-note">
        <h2 id="guide-note" className={styles.sectionTitle}>
          {t("helper.guideNoteTitle")}
        </h2>
        <ul className={styles.notes}>
          <li>{t("helper.guideNote1")}</li>
          <li>{t("helper.guideNote2")}</li>
          <li>{t("helper.guideNote3")}</li>
          <li>{t("helper.guideNote4")}</li>
        </ul>
      </section>
    </div>
  );
}
