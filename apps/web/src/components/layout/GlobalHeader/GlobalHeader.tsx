"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { RoleChooser } from "@/features/auth/login/RoleChooser";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { logout } from "@/services/auth/logout";
import { LanguageMenu } from "../LanguageMenu";
import { ThemeToggle } from "../ThemeToggle";
import { CreatorProfileMenu, type CreatorHeaderInfo } from "./CreatorProfileMenu";
import { ProfileMenu } from "./ProfileMenu";
import styles from "./GlobalHeader.module.css";

/**
 * Global navigation bar.
 *
 * Figma:
 * - Guest:     710:305  (Funation creator donation page_with login / nav-bar)
 * - Signed in: 710:978  (Funation creator donation page / nav-bar)
 *
 * - Creator:   245:14 (📺 크리에이터 · 고객센터, channel profile dropdown 758:41)
 *
 * Figma only has the 1440px layout. Below 900px the center links move into a
 * dropdown opened by the mobile menu toggle. Between 901px and 1240px the
 * language button shows only the flag, up to 1024px the 마이페이지 link is hidden
 * (it is in the profile dropdown), and the profile name ellipsizes if still too long.
 */

export type GlobalHeaderUser = {
  nickname: string;
  avatarUrl?: string | null;
};

type NavItem = {
  href: string;
  label: MessageKey;
  /** Rendered as the yellow pill tab with this emoji (🔴 LIVE, 📺 크리에이터). */
  pillEmoji?: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/live", label: "nav.live", pillEmoji: "🔴" },
  { href: "/creators", label: "nav.creators" },
  { href: "/hall-of-fame", label: "nav.hallOfFame" },
  { href: "/support", label: "nav.support" }
];

/** Creator pages (Figma 245:14). */
const CREATOR_NAV_ITEMS: NavItem[] = [
  { href: "/creator", label: "nav.creatorStudio", pillEmoji: "📺" },
  { href: "/support", label: "nav.support" }
];

type GlobalHeaderProps = {
  /** Signed-in user. `null` renders the guest state with the login button. */
  user: GlobalHeaderUser | null;
  showMenuButton?: boolean;
  onMenuClick?: () => void;
  /** Creator pages swap the nav and the profile menu. */
  creator?: CreatorHeaderInfo | null;
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function GlobalHeader({ user, showMenuButton = true, onMenuClick, creator = null }: GlobalHeaderProps) {
  const pathname = usePathname() ?? "/";
  const navItems = creator ? CREATOR_NAV_ITEMS : NAV_ITEMS;
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useI18n();

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
          <button type="button" className={`${styles.menuButton} ${styles.desktopOnly}`} aria-label={t("common.openMenu")} onClick={onMenuClick}>
            <span className={styles.menuBar} />
            <span className={styles.menuBar} />
            <span className={styles.menuBar} />
          </button>
        )}
        <button
          type="button"
          className={`${styles.menuButton} ${styles.mobileOnly}`}
          aria-label={t(mobileOpen ? "common.closeMenu" : "common.openMenu")}
          aria-expanded={mobileOpen}
          aria-controls="global-mobile-nav"
          onClick={() => setMobileOpen((v) => !v)}
        >
          <span className={styles.menuBar} />
          <span className={styles.menuBar} />
          <span className={styles.menuBar} />
        </button>
        <Link href="/" className={styles.logo} aria-label={t("common.homeAria")}>
          <span className={styles.logoText}>Somnation</span>
          <span className={styles.logoBadge}>ON</span>
        </Link>
      </div>

      <nav className={styles.nav} aria-label={t("common.mainMenu")}>
        {navItems.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </nav>

      <div className={user ? styles.rightSignedIn : styles.rightGuest}>
        {user && !creator && (
          <Link href="/mypage" className={`${styles.myPage} ${styles.desktopOnly}`}>
            {t("common.myPage")}
          </Link>
        )}
        {user && creator && (
          <Link href="/creator" className={`${styles.myPage} ${styles.creatorMode} ${styles.desktopOnly}`}>
            {t("common.creator")}
          </Link>
        )}

        {/* The creator studio is dark-only for now (light TBD), so the switch is hidden there. */}
        {!creator && <ThemeToggle />}
        <LanguageMenu />

        {user && creator ? (
          <CreatorProfileMenu user={user} creator={creator} />
        ) : user ? (
          <ProfileMenu user={user} />
        ) : (
          // Figma 280:2: the guest login button opens the 로그인/회원가입 role chooser.
          <RoleChooser className={styles.loginButton} />
        )}
      </div>

      {mobileOpen && (
        <nav id="global-mobile-nav" className={styles.mobileNav} aria-label={t("common.mainMenu")}>
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} mobile />
          ))}
          {user && (
            <Link href="/mypage" className={styles.mobileNavLink} aria-current={isActive(pathname, "/mypage") ? "page" : undefined}>
              {t("common.myPage")}
            </Link>
          )}
          {user && (
            <form action={logout}>
              <button type="submit" className={styles.mobileNavLink}>
                {t("common.logout")}
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
  const label = useI18n().t(item.label);

  if (mobile) {
    return (
      <Link href={item.href} className={`${styles.mobileNavLink} ${active ? styles.mobileNavLinkActive : ""}`} aria-current={current}>
        {item.pillEmoji && (
          <span className={styles.liveDot} aria-hidden="true">
            {item.pillEmoji}
          </span>
        )}
        {label}
      </Link>
    );
  }

  if (item.pillEmoji) {
    return (
      <Link href={item.href} className={`${styles.liveTab} ${active ? styles.liveTabActive : ""}`} aria-current={current}>
        <span className={styles.liveDot} aria-hidden="true">
          {item.pillEmoji}
        </span>
        <span>{label}</span>
      </Link>
    );
  }

  return (
    <Link href={item.href} className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`} aria-current={current}>
      {label}
    </Link>
  );
}
