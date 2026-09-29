"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { CommunityOutlineIcon, HomeIcon, StarIcon, UserIcon } from "@/components/icons";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { GlobalHeader } from "../GlobalHeader";
import { SideNav, type SideNavUser } from "../SideNav";
import styles from "./AppShell.module.css";

/** Keep in sync with the drawer breakpoint in AppShell.module.css. */
const NARROW = "(max-width: 1024px)";

const TABS: { href: string; label: MessageKey; Icon: typeof HomeIcon }[] = [
  { href: "/", label: "side.home", Icon: HomeIcon },
  { href: "/favorites", label: "side.favorites", Icon: StarIcon },
  { href: "/community", label: "side.community", Icon: CommunityOutlineIcon },
  { href: "/mypage", label: "side.groupMy", Icon: UserIcon }
];

/**
 * Site shell for every (main) page — funnation structure: header on top, the side menu on the left on
 * every page (collapsible from the header ☰), and a bottom tab bar (홈 · 즐겨찾기 · 커뮤니티 · 마이) on
 * phones. Below 1025px the side menu becomes a drawer.
 */
export function AppShell({ user, children }: { user: SideNavUser | null; children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const { t } = useI18n();
  // Desktop: collapsed or not. Narrow screens: drawer open or not (closed on every navigation).
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => {
    const mq = window.matchMedia(NARROW);
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawer]);

  const toggle = () => (narrow ? setDrawer((v) => !v) : setCollapsed((v) => !v));

  return (
    <>
      <GlobalHeader user={user && { nickname: user.nickname, avatarUrl: user.avatarUrl, fnBalance: user.fnBalance }} creatorRole={user?.creator ?? false} onMenuClick={toggle} menuExpanded={narrow ? drawer : !collapsed} />
      <div className={styles.shell} data-collapsed={collapsed || undefined} data-drawer={drawer || undefined}>
        <div className={styles.side} id="site-side-menu">
          <SideNav user={user} onNavigate={() => setDrawer(false)} />
        </div>
        {drawer && <button type="button" className={styles.scrim} aria-label={t("common.closeMenu")} onClick={() => setDrawer(false)} />}
        <div className={styles.main}>{children}</div>
      </div>
      <nav className={styles.tabBar} aria-label={t("common.mainMenu")}>
        {TABS.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link key={href} href={user || href === "/" ? href : `/login?next=${href}`} className={styles.tab} aria-current={active ? "page" : undefined}>
              <Icon aria-hidden="true" />
              <span>{t(label)}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
