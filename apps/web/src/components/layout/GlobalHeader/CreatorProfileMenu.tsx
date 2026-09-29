"use client";

import Image from "next/image";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/services/auth/logout";
import { PLATFORM_LABEL, type Platform } from "@/types/platform";
import type { GlobalHeaderUser } from "./GlobalHeader";
import styles from "./GlobalHeader.module.css";

export type CreatorHeaderInfo = {
  channelName: string;
  /** Linked broadcast platforms; unlinked ones are dimmed (758:41). */
  platforms: { platform: Platform; logoUrl: string; connected: boolean }[];
};

/**
 * Creator profile chip + dropdown. Figma 245:14 (chip "홍길동의 방송 ▼") · 758:41 / 296:500 (dropdown).
 * The design's logos (치지직, YouTube, Twitch, FlexTV) are replaced with the confirmed platforms.
 */
export function CreatorProfileMenu({ user, creator }: { user: GlobalHeaderUser; creator: CreatorHeaderInfo }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => !rootRef.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const { t } = useI18n();
  return (
    <div className={styles.profileRoot} ref={rootRef}>
      <button
        type="button"
        className={`${styles.profile} ${open ? styles.profileOpen : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("profile.channelMenu", { name: creator.channelName })}
        onClick={() => setOpen((v) => !v)}
      >
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- user-supplied avatar from an arbitrary host
          <img className={styles.avatar} src={user.avatarUrl} alt="" width={32} height={32} />
        ) : (
          <span className={styles.avatarFallback} aria-hidden="true">
            {user.nickname.slice(0, 1)}
          </span>
        )}
        <span className={styles.profileName}>{creator.channelName}</span>
        <span className={styles.caret} aria-hidden="true">
          ▼
        </span>
      </button>
      {open && (
        <div className={styles.creatorMenu} role="menu">
          <ul className={styles.creatorPlatforms} aria-label={t("profile.platforms")}>
            {creator.platforms.map((p) => (
              <li key={p.platform} className={p.connected ? "" : styles.platformOff}>
                <Image src={p.logoUrl} alt="" width={30} height={30} />
                <span className={styles.srOnly}>
                  {PLATFORM_LABEL[p.platform]} {t(p.connected ? "profile.connected" : "profile.notConnected")}
                </span>
              </li>
            ))}
          </ul>
          <div className={styles.creatorMenuActions}>
            <Link href="/creator/settings" role="menuitem" className={styles.creatorMenuSettings} onClick={() => setOpen(false)}>
              {t("common.accountSettings")}
            </Link>
            <form action={logout}>
              <button type="submit" role="menuitem" className={styles.creatorMenuLogout}>
                {t("common.logout")}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
