"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./studio.module.css";

type Item = { label: string; emoji: string; href?: string };

/** Figma 245:14 sidebar (240 wide). Items without `href` have no screen yet. */
const ITEMS: Item[] = [
  { label: "대시보드", emoji: "📊", href: "/creator" },
  { label: "후원위젯/알림설정", emoji: "🔔", href: "/creator/widgets" },
  { label: "크리에이터 랭킹", emoji: "🏆", href: "/creator/ranking" },
  { label: "후원관리+", emoji: "💰", href: "/creator/donations" },
  { label: "계정설정", emoji: "⚙️", href: "/creator/settings" },
  { label: "정산설정", emoji: "📋", href: "/creator/settlement" }
];

export function CreatorSideNav() {
  const pathname = usePathname() ?? "/creator";
  return (
    <nav className={styles.sidebar} aria-label="크리에이터 메뉴">
      <ul>
        {ITEMS.map((item) => {
          const content = (
            <>
              <span className={styles.sideEmoji} aria-hidden="true">
                {item.emoji}
              </span>
              {item.label}
            </>
          );
          // Sub-pages (e.g. /creator/settlement/register) keep their section highlighted.
          const active = item.href === "/creator" ? pathname === item.href : !!item.href && (pathname === item.href || pathname.startsWith(`${item.href}/`));
          return (
            <li key={item.label}>
              {item.href ? (
                <Link href={item.href} className={`${styles.sideItem} ${active ? styles.sideItemActive : ""}`} aria-current={active ? "page" : undefined}>
                  {content}
                </Link>
              ) : (
                <span className={`${styles.sideItem} ${styles.sideItemOff}`} aria-disabled="true" title="준비 중인 기능입니다">
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
