"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/I18nProvider";
import styles from "../crew/crew.module.css";

/** 시청자 참여 게임 sub-navigation (code-first): a page per game. */
export function PlayTabs({ active }: { active: "marble" | "rumble" | "live" }) {
  const { t } = useI18n();
  return (
    <nav className={styles.tabs} aria-label={t("studioPlay.pageTitle")}>
      <Link href="/creator/widgets/play" className={styles.tab} aria-current={active === "marble" ? "page" : undefined}>
        {t("studioPlay.marble")}
      </Link>
      <Link href="/creator/widgets/play/rumble" className={styles.tab} aria-current={active === "rumble" ? "page" : undefined}>
        {t("studioPlay.rumble")}
      </Link>
      <Link href="/creator/widgets/play/live" className={styles.tab} aria-current={active === "live" ? "page" : undefined}>
        {t("studioPlay.liveTab")}
      </Link>
    </nav>
  );
}
