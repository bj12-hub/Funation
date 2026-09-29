"use client";

import Image from "next/image";
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

  return (
    <div className={styles.profileRoot} ref={rootRef}>
      <button
        type="button"
        className={`${styles.profile} ${open ? styles.profileOpen : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${creator.channelName} 메뉴`}
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
          <ul className={styles.creatorPlatforms} aria-label="연결된 방송 플랫폼">
            {creator.platforms.map((p) => (
              <li key={p.platform} className={p.connected ? "" : styles.platformOff}>
                <Image src={p.logoUrl} alt="" width={30} height={30} />
                <span className={styles.srOnly}>
                  {PLATFORM_LABEL[p.platform]} {p.connected ? "연결됨" : "연결 안 됨"}
                </span>
              </li>
            ))}
          </ul>
          <div className={styles.creatorMenuActions}>
            {/* TODO: creator account settings (315:405) are the next creator screen. */}
            <span role="menuitem" aria-disabled="true" className={styles.creatorMenuSettings} title="준비 중인 기능입니다">
              계정설정
            </span>
            <form action={logout}>
              <button type="submit" role="menuitem" className={styles.creatorMenuLogout}>
                로그아웃
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
