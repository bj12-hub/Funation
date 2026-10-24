"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FocusEvent } from "react";
import styles from "./studio.module.css";

/**
 * Creator studio sidebar — groups follow the funnation studio (docs/architecture/information-architecture.md):
 * 내 채널 · 채널 · 방송 · 크루 방송 · 수익 · 정산 · 소식. Visual style keeps Figma 245:14 (240 wide).
 * Items without `href` have no screen yet (준비 중). 후원관리+ tabs are linked individually by `?tab=`.
 *
 * Phones (≤ 767px, 기본값 — 일반적인 기준; code-first, no Figma frame): the menu folds behind a bar naming the current
 * page ("📊 대시보드 · 메뉴 ▾") so the page starts right under the header, and the bar opens the same grouped menu as
 * a dropdown. Like the site drawer (AppShell) it closes on navigation, on Escape (focus back on the bar), on a tap
 * outside it (the dimmed page) and when focus leaves it. Wider screens never show the bar: the sidebar is unchanged.
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
      { label: "유튜브 연동", emoji: "▶️", href: "/creator/youtube" },
      { label: "영상 목록", emoji: "🎞️", href: "/creator/videos" }
    ]
  },
  {
    title: "방송",
    items: [
      { label: "통합 채팅", emoji: "💬", href: "/creator/chat" },
      { label: "위젯", emoji: "🔔", href: "/creator/widgets" },
      { label: "방송 도구", emoji: "🛠️", href: "/creator/widgets/tools" },
      { label: "시청자 참여", emoji: "🎮", href: "/creator/widgets/play" },
      { label: "오버레이 주소", emoji: "🔗", href: "/creator/widgets/overlays" },
      { label: "원소스 배치", emoji: "🧩", href: "/creator/widgets/onesource" },
      { label: "커스텀 오버레이", emoji: "💻", href: "/creator/widgets/custom" },
      { label: "이미지·사운드", emoji: "🎵", href: "/creator/widgets/assets" },
      { label: "리모컨", emoji: "🎛️", href: "/creator/remote" }
    ]
  },
  {
    // funnation "엑셀방송".
    title: "크루 방송",
    items: [
      { label: "크루 관리", emoji: "👥", href: "/creator/crew" },
      { label: "방송 운영", emoji: "📋", href: "/creator/crew/broadcast" },
      { label: "점수 게임", emoji: "🎰", href: "/creator/crew/games" }
    ]
  },
  {
    title: "수익",
    items: [
      { label: "수익 현황", emoji: "📊", href: "/creator/revenue" },
      { label: "받은 후원", emoji: "💰", href: "/creator/donations?tab=list" },
      { label: "후원 순위", emoji: "🏆", href: "/creator/donations?tab=ranking" },
      { label: "후원 필터링", emoji: "🛡️", href: "/creator/donations?tab=filtering" },
      { label: "내역 이관", emoji: "📥", href: "/creator/donations?tab=import" },
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

/** The phone bar's label: the menu item of the current page, or the studio's name on a page outside the menu. */
export function studioCurrentItem(active: string | null): { label: string; emoji: string | null; inMenu: boolean } {
  const item = active ? GROUPS.flatMap((g) => g.items).find((i) => i.href === active) : undefined;
  return item ? { label: item.label, emoji: item.emoji, inMenu: true } : { label: "크리에이터 스튜디오", emoji: null, inMenu: false };
}

/** The phone dropdown (always in the page, shown by studio.module.css while open on phones). */
export const STUDIO_MENU_ID = "studio-side-menu";

export function CreatorSideNav() {
  const pathname = usePathname() ?? "/creator";
  const tab = useSearchParams()?.get("tab") ?? null;
  const active = studioActiveHref(pathname, tab);
  const current = studioCurrentItem(active);
  // Phones only: whether the dropdown is open. Wider screens hide the bar and always show the menu.
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Closed on every navigation (a link to the page already shown closes it in its onClick).
  useEffect(() => setOpen(false), [pathname, tab]);

  useEffect(() => {
    if (!open) return;
    // A tap anywhere but the bar and the menu (the dimmed page, the header) closes it without moving focus.
    const onPointer = (e: Event) => {
      const target = e.target as Node | null;
      if (!buttonRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Choosing an item: the menu closes and focus goes back to the bar, which stays on the next page (the layout keeps it).
  const onChoose = () => {
    if (!open) return;
    setOpen(false);
    buttonRef.current?.focus();
  };
  // Tabbing out of the open menu closes it.
  const onBlur = (e: FocusEvent<HTMLElement>) => {
    const next = e.relatedTarget as Node | null;
    if (open && next && !e.currentTarget.contains(next)) setOpen(false);
  };

  return (
    <nav className={styles.sidebar} aria-label="크리에이터 메뉴" data-open={open || undefined} onBlur={onBlur}>
      <button ref={buttonRef} type="button" className={styles.sideToggle} aria-expanded={open} aria-controls={STUDIO_MENU_ID} onClick={() => setOpen((v) => !v)}>
        <span className={styles.sideToggleCurrent}>
          {current.emoji && (
            <span className={styles.sideEmoji} aria-hidden="true">
              {current.emoji}
            </span>
          )}
          <span className={styles.sideToggleLabel}>{current.label}</span>
          {current.inMenu && <span className={styles.srOnly}> (현재 페이지)</span>}
        </span>
        <span className={styles.sideToggleMore}>
          메뉴
          <span className={styles.sideChevron} aria-hidden="true">
            ▾
          </span>
        </span>
      </button>
      <div className={styles.sideScrim} aria-hidden="true" />
      <div ref={panelRef} id={STUDIO_MENU_ID} className={styles.sideMenu}>
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
                      <Link href={item.href} className={`${styles.sideItem} ${isActive ? styles.sideItemActive : ""}`} aria-current={isActive ? "page" : undefined} onClick={onChoose}>
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
      </div>
    </nav>
  );
}
