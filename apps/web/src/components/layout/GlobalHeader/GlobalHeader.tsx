"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { HomeIcon, SearchOutlineIcon } from "@/components/icons";
import { RoleChooser } from "@/features/auth/login/RoleChooser";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { logout } from "@/services/auth/logout";
import { LanguageMenu } from "../LanguageMenu";
import { ThemeToggle } from "../ThemeToggle";
import { CreatorProfileMenu, type CreatorHeaderInfo } from "./CreatorProfileMenu";
import { NotificationBell } from "./NotificationBell";
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
  /** Server-provided FN balance for the 충전 chip (site shell only). */
  fnBalance?: number | null;
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

type GlobalHeaderProps = {
  /** Signed-in user. `null` renders the guest state with the login button. */
  user: GlobalHeaderUser | null;
  showMenuButton?: boolean;
  onMenuClick?: () => void;
  /** Creator pages swap the nav and the profile menu. */
  creator?: CreatorHeaderInfo | null;
  /** Site shell: whether the member has the Creator role (profile menu entry). */
  creatorRole?: boolean;
  /** Site shell: side menu visible (for the ☰ button's aria-expanded). */
  menuExpanded?: boolean;
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function GlobalHeader({ user, showMenuButton = true, onMenuClick, creator = null, creatorRole = false, menuExpanded = true }: GlobalHeaderProps) {
  const pathname = usePathname() ?? "/";
  const navItems = NAV_ITEMS;
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

  // Site pages (AppShell) use the funnation-style header; auth and studio pages keep the Figma one.
  if (user && creator) return <StudioHeader user={user} creator={creator} />;
  if (onMenuClick && !creator) return <SiteHeader user={user} creatorRole={creatorRole} onMenuClick={onMenuClick} menuExpanded={menuExpanded} />;

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
          // The menu is only rendered while open.
          aria-controls={mobileOpen ? "global-mobile-nav" : undefined}
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
        {user && (
          <Link href="/mypage" className={`${styles.myPage} ${styles.desktopOnly}`}>
            {t("common.myPage")}
          </Link>
        )}

        <ThemeToggle />
        <LanguageMenu />

        {user ? (
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

/**
 * Site header — funnation structure: ☰ (side menu) · logo on the left; 검색 · 충전 (FN) · 알림 ·
 * theme · language · profile on the right. The menu links live in the side menu, not the header.
 * 알림 opens the notification popover (NotificationBell).
 */
function SiteHeader({ user, creatorRole, onMenuClick, menuExpanded }: { user: GlobalHeaderUser | null; creatorRole: boolean; onMenuClick: () => void; menuExpanded: boolean }) {
  const { t } = useI18n();
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <button type="button" className={styles.menuButton} aria-label={t(menuExpanded ? "common.closeMenu" : "common.openMenu")} aria-expanded={menuExpanded} aria-controls="site-side-menu" onClick={onMenuClick}>
          <span className={styles.menuBar} />
          <span className={styles.menuBar} />
          <span className={styles.menuBar} />
        </button>
        <Link href="/" className={styles.logo} aria-label={t("common.homeAria")}>
          <span className={styles.logoText}>Somnation</span>
          <span className={styles.logoBadge}>ON</span>
        </Link>
      </div>

      <div className={user ? styles.rightSignedIn : styles.rightGuest}>
        <Link href="/creators" className={styles.iconButton} aria-label={t("common.search")} title={t("common.search")}>
          <SearchOutlineIcon />
        </Link>
        {user && (
          <Link href="/wallet" className={styles.chargeChip} aria-label={t("common.chargeAria", { balance: user.fnBalance == null ? "—" : formatNumber(user.fnBalance) })}>
            <span className={styles.chargeLabel}>{t("common.charge")}</span>
            <span>{user.fnBalance == null ? "—" : formatNumber(user.fnBalance)}</span>
          </Link>
        )}
        {user && <NotificationBell />}
        <ThemeToggle />
        <LanguageMenu />
        {user ? <ProfileMenu user={user} creatorRole={creatorRole} /> : <RoleChooser className={styles.loginButton} />}
      </div>
    </header>
  );
}

/**
 * Creator studio header — funnation structure: logo + 스튜디오 on the left; 사이트로 (home) · 알림 ·
 * language · channel menu on the right. Studio navigation lives in the studio sidebar.
 */
function StudioHeader({ user, creator }: { user: GlobalHeaderUser; creator: CreatorHeaderInfo }) {
  const { t } = useI18n();
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <Link href="/creator" className={styles.logo} aria-label={t("common.studioHome")}>
          <span className={styles.logoText}>Somnation</span>
          <span className={styles.studioBadge}>{t("common.studio")}</span>
        </Link>
      </div>
      <div className={styles.rightSignedIn}>
        <Link href="/" className={styles.iconButton} aria-label={t("common.toSite")} title={t("common.toSite")}>
          <HomeIcon />
        </Link>
        <NotificationBell />
        <LanguageMenu />
        <CreatorProfileMenu user={user} creator={creator} />
      </div>
    </header>
  );
}
