"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/services/auth/logout";
import type { GlobalHeaderUser } from "./GlobalHeader";
import styles from "./GlobalHeader.module.css";

/**
 * Signed-in profile button (Figma 710:978 profile-logged-in) with its dropdown.
 * The dropdown itself is not in Figma; it reuses the language menu styling.
 */
export function ProfileMenu({ user }: { user: GlobalHeaderUser }) {
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
        className={styles.profile}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("profile.accountMenu", { name: user.nickname })}
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
        <span className={styles.profileName}>{t("profile.fun", { name: user.nickname })}</span>
        <span className={styles.caret} aria-hidden="true">
          ▼
        </span>
      </button>
      {open && (
        <div className={styles.profileMenu} role="menu">
          <Link href="/mypage" role="menuitem" className={styles.profileMenuItem} onClick={() => setOpen(false)}>
            {t("common.myPage")}
          </Link>
          <Link href="/creator" role="menuitem" className={styles.profileMenuItem} onClick={() => setOpen(false)}>
            {t("common.creator")}
          </Link>
          <form action={logout}>
            <button type="submit" role="menuitem" className={styles.profileMenuItem}>
              {t("common.logout")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
