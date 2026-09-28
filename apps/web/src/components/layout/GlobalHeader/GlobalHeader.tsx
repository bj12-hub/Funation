"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./GlobalHeader.module.css";

/**
 * Global navigation bar.
 *
 * Figma:
 * - Guest:     710:305  (FunNation creator donation page_with login / nav-bar)
 * - Signed in: 710:978  (FunNation creator donation page / nav-bar)
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

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        {showMenuButton && (
          <button type="button" className={styles.menuButton} aria-label="메뉴 열기" onClick={onMenuClick}>
            <span className={styles.menuBar} />
            <span className={styles.menuBar} />
            <span className={styles.menuBar} />
          </button>
        )}
        <Link href="/" className={styles.logo} aria-label="FunNation 홈">
          <span className={styles.logoText}>FunNation</span>
          <span className={styles.logoBadge}>ON</span>
        </Link>
      </div>

      <nav className={styles.nav} aria-label="주요 메뉴">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);

          if (item.isLive) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.liveTab} ${active ? styles.liveTabActive : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <span className={styles.liveDot} aria-hidden="true">
                  🔴
                </span>
                <span>{item.label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className={user ? styles.rightSignedIn : styles.rightGuest}>
        {user && (
          <Link href="/mypage" className={styles.myPage}>
            마이페이지
          </Link>
        )}

        <button type="button" className={styles.language} aria-label="언어 선택: 한국어">
          <span className={styles.languageFlag} aria-hidden="true">
            🇰🇷
          </span>
          <span>한국어</span>
        </button>

        {user ? (
          <button type="button" className={styles.profile} aria-haspopup="menu">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- user-supplied avatar from an arbitrary host
              <img className={styles.avatar} src={user.avatarUrl} alt="" width={32} height={32} />
            ) : (
              <span className={styles.avatarFallback} aria-hidden="true">
                {user.nickname.slice(0, 1)}
              </span>
            )}
            <span className={styles.profileName}>{user.nickname}의 FuN!</span>
            <span className={styles.caret} aria-hidden="true">
              ▼
            </span>
          </button>
        ) : (
          <Link href="/login" className={styles.loginButton}>
            로그인
          </Link>
        )}
      </div>
    </header>
  );
}
