"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logout } from "@/services/auth/logout";
import { LanguageMenu } from "../LanguageMenu";
import { ProfileMenu } from "./ProfileMenu";
import styles from "./GlobalHeader.module.css";

/**
 * Global navigation bar.
 *
 * Figma:
 * - Guest:     710:305  (Funation creator donation page_with login / nav-bar)
 * - Signed in: 710:978  (Funation creator donation page / nav-bar)
 *
 * Figma only has the 1440px layout. Below 900px the center links move into a
 * dropdown opened by the mobile menu toggle.
 */

export type GlobalHeaderUser = {
  nickname: string;
  avatarUrl?: string | null;
};

type NavItem = {
  href: string;
  label: string;
  isLive?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/live", label: "LIVE", isLive: true },
  { href: "/creators", label: "인기 크리에이터" },
  { href: "/hall-of-fame", label: "명예의 전당" },
  { href: "/support", label: "고객센터" }
];

type GlobalHeaderProps = {
  /** Signed-in user. `null` renders the guest state with the login button. */
  user: GlobalHeaderUser | null;
  showMenuButton?: boolean;
  onMenuClick?: () => void;
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function GlobalHeader({ user, showMenuButton = true, onMenuClick }: GlobalHeaderProps) {
  const pathname = usePathname() ?? "/";
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile menu after navigating.
  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        {showMenuButton && (
          <button type="button" className={`${styles.menuButton} ${styles.desktopOnly}`} aria-label="메뉴 열기" onClick={onMenuClick}>
            <span className={styles.menuBar} />
            <span className={styles.menuBar} />
            <span className={styles.menuBar} />
          </button>
        )}
        <button
          type="button"
          className={`${styles.menuButton} ${styles.mobileOnly}`}
          aria-label={mobileOpen ? "메뉴 닫기" : "메뉴 열기"}
          aria-expanded={mobileOpen}
          aria-controls="global-mobile-nav"
          onClick={() => setMobileOpen((v) => !v)}
        >
          <span className={styles.menuBar} />
          <span className={styles.menuBar} />
          <span className={styles.menuBar} />
        </button>
        <Link href="/" className={styles.logo} aria-label="Funation 홈">
          <span className={styles.logoText}>Funation</span>
          <span className={styles.logoBadge}>ON</span>
        </Link>
      </div>

      <nav className={styles.nav} aria-label="주요 메뉴">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </nav>

      <div className={user ? styles.rightSignedIn : styles.rightGuest}>
        {user && (
          <Link href="/mypage" className={`${styles.myPage} ${styles.desktopOnly}`}>
            마이페이지
          </Link>
        )}

        <LanguageMenu />

        {user ? (
          <ProfileMenu user={user} />
        ) : (
          <Link href="/login" className={styles.loginButton}>
            로그인
          </Link>
        )}
      </div>

      {mobileOpen && (
        <nav id="global-mobile-nav" className={styles.mobileNav} aria-label="주요 메뉴">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} mobile />
          ))}
          {user && (
            <Link href="/mypage" className={styles.mobileNavLink} aria-current={isActive(pathname, "/mypage") ? "page" : undefined}>
              마이페이지
            </Link>
          )}
          {user && (
            <form action={logout}>
              <button type="submit" className={styles.mobileNavLink}>
                로그아웃
              </button>
            </form>
          )}
        </nav>
      )}
    </header>
  );
}

function NavLink({ item, active, mobile = false }: { item: NavItem; active: boolean; mobile?: boolean }) {
  const current = active ? "page" : undefined;

  if (mobile) {
    return (
      <Link href={item.href} className={`${styles.mobileNavLink} ${active ? styles.mobileNavLinkActive : ""}`} aria-current={current}>
        {item.isLive && (
          <span className={styles.liveDot} aria-hidden="true">
            🔴
          </span>
        )}
        {item.label}
      </Link>
    );
  }

  if (item.isLive) {
    return (
      <Link href={item.href} className={`${styles.liveTab} ${active ? styles.liveTabActive : ""}`} aria-current={current}>
        <span className={styles.liveDot} aria-hidden="true">
          🔴
        </span>
        <span>{item.label}</span>
      </Link>
    );
  }

  return (
    <Link href={item.href} className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`} aria-current={current}>
      {item.label}
    </Link>
  );
}
