"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { logout } from "@/services/auth/logout";
import { PLATFORM_LABEL, type Platform } from "@/types/platform";
import { openRemoteWindow } from "@/features/creatorStudio/remote/remoteWindow";
import { HELPER_BRAND, HELPER_NAV, HELPER_REMOTE, HELPER_REMOTE_GUIDE, helperActiveHref } from "./helperNav";
import styles from "./helper.module.css";

export type HelperShellUser = {
  nickname: string;
  channelName: string;
  avatarUrl: string | null;
  platforms: { platform: Platform; logoUrl: string; connected: boolean }[];
};

export function HelperBrand() {
  return (
    <Link href="/" className={styles.brand} aria-label={`${HELPER_BRAND.name} ${HELPER_BRAND.product} 홈`}>
      <span className={styles.brandName}>{HELPER_BRAND.name}</span>
      <span className={styles.brandBadge}>{HELPER_BRAND.product}</span>
    </Link>
  );
}

/**
 * Ssumnation 도우미 shell — code-first (no Figma frame), 2026-10-14 결정. Legacy FlexTV 도우미 layout: brand, the
 * creator's profile and the feature menu on the left, the 리모컨 button at the bottom. Below 900px the menu is a drawer.
 */
export function HelperShell({ user, children }: { user: HelperShellUser; children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const active = helperActiveHref(pathname);
  const [open, setOpen] = useState(false);

  // A menu choice closes the drawer.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div data-theme="dark" className={styles.scope}>
      <div className={styles.topBar}>
        <HelperBrand />
        <button type="button" className={styles.menuButton} aria-label="메뉴 열기" aria-expanded={open} aria-controls="helper-menu" onClick={() => setOpen(true)}>
          ☰
        </button>
      </div>
      <div className={styles.shell}>
        {open && <button type="button" className={styles.backdrop} aria-label="메뉴 닫기" onClick={() => setOpen(false)} />}
        <aside id="helper-menu" className={`${styles.sidebar} ${open ? styles.sidebarOpen : ""}`} aria-label="도우미 메뉴">
          <HelperBrand />
          <Profile user={user} />
          <nav className={styles.sideScroll} aria-label="도우미 기능">
            {HELPER_NAV.map((g, i) => (
              <div key={g.title ?? `g${i}`} className={styles.group}>
                {g.title && <p className={styles.groupTitle}>{g.title}</p>}
                <ul>
                  {g.items.map((item) => {
                    const isActive = item.href === active;
                    return (
                      <li key={item.href}>
                        <Link href={item.href} className={`${styles.item} ${isActive ? styles.itemActive : ""}`} aria-current={isActive ? "page" : undefined}>
                          <span className={styles.emoji} aria-hidden="true">
                            {item.emoji}
                          </span>
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
          <div className={styles.remoteArea}>
            {/* Legacy "도우미 웹 버전 열기 · 라이브 방송 리모컨": a 1000 × 800 window; shown here when popups are blocked. */}
            <button type="button" className={styles.remoteButton} onClick={() => openRemoteWindow() || router.push(HELPER_REMOTE.href)}>
              <span className={styles.remoteIcon} aria-hidden="true">
                🎛️
              </span>
              <span className={styles.remoteText}>
                <strong>{HELPER_REMOTE.label}</strong>
                <span>{HELPER_REMOTE.sub}</span>
              </span>
            </button>
            <div className={styles.remoteLinks}>
              <Link href={HELPER_REMOTE.href} aria-current={pathname === HELPER_REMOTE.href ? "page" : undefined}>
                이 창에서 열기
              </Link>
              <Link href={HELPER_REMOTE_GUIDE} aria-current={pathname === HELPER_REMOTE_GUIDE ? "page" : undefined}>
                리모컨 가이드
              </Link>
            </div>
          </div>
        </aside>
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}

function Profile({ user }: { user: HelperShellUser }) {
  return (
    <div className={styles.profile}>
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- user-supplied photo from an arbitrary host
        <img className={styles.avatar} src={user.avatarUrl} alt="" width={40} height={40} />
      ) : (
        <span className={styles.avatarFallback} aria-hidden="true">
          {user.nickname.slice(0, 1)}
        </span>
      )}
      <span className={styles.profileText}>
        <strong>{user.channelName}</strong>
        <span>{user.nickname}</span>
      </span>
      <span className={styles.profileFoot}>
        <span className={styles.platforms}>
          {user.platforms.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element -- small platform logo
            <img
              key={p.platform}
              className={styles.platform}
              src={p.logoUrl}
              alt={`${PLATFORM_LABEL[p.platform]} ${p.connected ? "연결됨" : "연결 안 됨"}`}
              title={`${PLATFORM_LABEL[p.platform]} ${p.connected ? "연결됨" : "연결 안 됨"}`}
              width={20}
              height={20}
              data-off={p.connected ? undefined : ""}
            />
          ))}
        </span>
        <form action={logout} className={styles.logout}>
          <button type="submit">로그아웃</button>
        </form>
      </span>
    </div>
  );
}
