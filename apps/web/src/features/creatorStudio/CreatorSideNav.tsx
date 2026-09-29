"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import styles from "./studio.module.css";

/**
 * Creator studio sidebar — groups follow the funnation studio (docs/architecture/information-architecture.md):
 * 내 채널 · 채널 · 방송 · 크루 방송 · 수익 · 정산 · 소식. Visual style keeps Figma 245:14 (240 wide).
 * Items without `href` have no screen yet (준비 중). 후원관리+ tabs are linked individually by `?tab=`.
 */
type Item = { label: string; emoji: string; href?: string };
type Group = { title: string | null; items: Item[] };

const GROUPS: Group[] = [
  { title: null, items: [{ label: "대시보드", emoji: "📊", href: "/creator" }] },
  {
    title: "채널",
    items: [
      { label: "채널 설정", emoji: "⚙️", href: "/creator/settings" },
      { label: "후원 페이지 설정", emoji: "🧾", href: "/creator/donations?tab=settings" },
      { label: "칭호 관리", emoji: "🏅", href: "/creator/donations?tab=titles" },
      { label: "유튜브 연동", emoji: "▶️" },
      { label: "영상 목록", emoji: "🎞️" }
    ]
  },
  {
    title: "방송",
    items: [
      { label: "위젯", emoji: "🔔", href: "/creator/widgets" },
      { label: "방송 도구", emoji: "🛠️", href: "/creator/widgets/tools" },
      { label: "오버레이 주소", emoji: "🔗", href: "/creator/widgets/overlays" },
      { label: "이미지·사운드", emoji: "🎵" },
      { label: "리모컨", emoji: "🎛️", href: "/creator/remote" }
    ]
  },
  {
    // funnation "엑셀방송".
    title: "크루 방송",
    items: [
      { label: "크루 관리", emoji: "👥", href: "/creator/crew" },
      { label: "방송 운영", emoji: "📋", href: "/creator/crew/broadcast" }
    ]
  },
  {
    title: "수익",
    items: [
      { label: "수익 현황", emoji: "📊", href: "/creator/revenue" },
      { label: "받은 후원", emoji: "💰", href: "/creator/donations?tab=list" },
      { label: "후원 순위", emoji: "🏆", href: "/creator/donations?tab=ranking" },
      { label: "후원 필터링", emoji: "🛡️", href: "/creator/donations?tab=filtering" },
      { label: "크리에이터 랭킹", emoji: "📈", href: "/creator/ranking" }
    ]
  },
  {
    title: "정산",
    items: [
      { label: "정산 현황", emoji: "🧮", href: "/creator/settlement" },
      { label: "정산 인증·등록", emoji: "🪪", href: "/creator/settlement/register" },
      { label: "정산 신청", emoji: "💸", href: "/creator/settlement/apply" },
      { label: "정산 관리", emoji: "🗂️", href: "/creator/settlement/manage" }
    ]
  },
  { title: null, items: [{ label: "소식", emoji: "📰", href: "/creator/updates" }] }
];

const DONATIONS = "/creator/donations";
const PATHS = GROUPS.flatMap((g) => g.items.map((i) => i.href)).filter((h): h is string => Boolean(h) && !h!.startsWith(`${DONATIONS}?`));

/** Active item: 후원관리+ matches its `?tab=` (default 후원 페이지 설정); other pages the most specific path. */
export function studioActiveHref(pathname: string, tab: string | null) {
  if (pathname === DONATIONS) return `${DONATIONS}?tab=${tab ?? "settings"}`;
  return PATHS.filter((h) => (h === "/creator" ? pathname === h : pathname === h || pathname.startsWith(`${h}/`))).sort((a, b) => b.length - a.length)[0] ?? null;
}

export function CreatorSideNav() {
  const pathname = usePathname() ?? "/creator";
  const tab = useSearchParams()?.get("tab") ?? null;
  const active = studioActiveHref(pathname, tab);

  return (
    <nav className={styles.sidebar} aria-label="크리에이터 메뉴">
      {GROUPS.map((g, i) => (
        <div key={g.title ?? `g${i}`} className={styles.sideGroup}>
          {g.title && <p className={styles.sideGroupTitle}>{g.title}</p>}
          <ul>
            {g.items.map((item) => {
              const content = (
                <>
                  <span className={styles.sideEmoji} aria-hidden="true">
                    {item.emoji}
                  </span>
                  {item.label}
                </>
              );
              const isActive = item.href === active;
              return (
                <li key={item.label}>
                  {item.href ? (
                    <Link href={item.href} className={`${styles.sideItem} ${isActive ? styles.sideItemActive : ""}`} aria-current={isActive ? "page" : undefined}>
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
        </div>
      ))}
    </nav>
  );
}
