"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FocusEvent } from "react";
import { FLEXTV_STUDIO } from "@/lib/flextv/mode";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
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

const MOCK_GROUPS: Group[] = [
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
      { label: "채팅봇", emoji: "🤖", href: "/creator/chat/bot" },
      { label: "위젯", emoji: "🔔", href: "/creator/widgets" },
      { label: "방송 도구", emoji: "🛠️", href: "/creator/widgets/tools" },
      { label: "시청자 참여", emoji: "🎮", href: "/creator/widgets/play" },
      { label: "오버레이 주소", emoji: "🔗", href: "/creator/widgets/overlays" },
      { label: "원소스 배치", emoji: "🧩", href: "/creator/widgets/onesource" },
      { label: "커스텀 오버레이", emoji: "💻", href: "/creator/widgets/custom" },
      { label: "외부 프로그램 연동", emoji: "🔌", href: "/creator/widgets/bridge" },
      { label: "이미지·사운드", emoji: "🎵", href: "/creator/widgets/assets" },
      { label: "음악 편집기", emoji: "🎚️", href: "/creator/widgets/music" },
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

/**
 * With FLEXTV (phase 5): the menus that run on it — lib/flextv/studioRoutes.ts serves no other studio page. 받은 후원
 * is the only 후원관리 tab, and the 정산 계좌 is registered on FLEXTV's site. 채널 설정 is FLEXTV's 방송국 (phase 7).
 */
const FLEXTV_GROUPS: Group[] = [
  { title: null, items: [{ label: "대시보드", emoji: "📊", href: "/creator" }] },
  { title: "채널", items: [{ label: "채널 설정", emoji: "⚙️", href: "/creator/settings" }] },
  { title: "방송", items: [{ label: "방송 설정", emoji: "🎥", href: "/creator/broadcast" }] },
  {
    title: "수익",
    items: [
      { label: "수익 현황", emoji: "📊", href: "/creator/revenue" },
      { label: "받은 후원", emoji: "💰", href: "/creator/donations?tab=list" }
    ]
  },
  {
    title: "정산",
    items: [
      { label: "정산 현황", emoji: "🧮", href: "/creator/settlement" },
      { label: "정산 계좌", emoji: "🪪", href: "/creator/settlement/register" },
      { label: "정산 신청", emoji: "💸", href: "/creator/settlement/apply" },
      { label: "정산 관리", emoji: "🗂️", href: "/creator/settlement/manage" }
    ]
  }
];

/** `donationTypes`: FLEXTV's Ssumnation endpoints are on (phase 6), so 후원 종류 설정 is offered. */
export const studioGroups = (flextv: boolean, donationTypes = false): Group[] => {
  if (!flextv) return MOCK_GROUPS;
  if (!donationTypes) return FLEXTV_GROUPS;
  return FLEXTV_GROUPS.map((g) =>
    g.title === "방송"
      ? {
          ...g,
          items: [...g.items, { label: "후원 종류 설정", emoji: "🎁", href: "/creator/donation-types" }, { label: "리모컨", emoji: "🎛️", href: "/creator/remote" }]
        }
      : g
  );
};
const GROUPS = studioGroups(FLEXTV_STUDIO);

const DONATIONS = "/creator/donations";

/**
 * Active item: 후원관리+ matches its `?tab=` (default 후원 페이지 설정, 받은 후원 with FLEXTV); other pages the most
 * specific path.
 */
export function studioActiveHref(pathname: string, tab: string | null, groups: Group[] = GROUPS) {
  if (pathname === DONATIONS) return `${DONATIONS}?tab=${tab ?? (groups === MOCK_GROUPS ? "settings" : "list")}`;
  const paths = groups.flatMap((g) => g.items.map((i) => i.href)).filter((h): h is string => Boolean(h) && !h!.startsWith(`${DONATIONS}?`));
  return paths.filter((h) => (h === "/creator" ? pathname === h : pathname === h || pathname.startsWith(`${h}/`))).sort((a, b) => b.length - a.length)[0] ?? null;
}

/** The phone bar's label: the menu item of the current page, or the studio's name on a page outside the menu. */
export function studioCurrentItem(active: string | null, groups: Group[] = GROUPS): { label: string; emoji: string | null; inMenu: boolean } {
  const item = active ? groups.flatMap((g) => g.items).find((i) => i.href === active) : undefined;
  return item ? { label: item.label, emoji: item.emoji, inMenu: true } : { label: "크리에이터 스튜디오", emoji: null, inMenu: false };
}

/**
 * The menu in the viewer's language (2026-11-01): the group titles, item labels and studio name above are the Korean source
 * (studioCurrentItem names the current item by them); each maps to its message key here. A label not listed shows as written.
 */
const LABEL_KEYS: Record<string, MessageKey> = {
  대시보드: "studioNav.dashboard",
  채널: "studioNav.groupChannel",
  "채널 설정": "studioNav.channelSettings",
  "후원 페이지 설정": "studioNav.donationPage",
  "칭호 관리": "studioNav.titles",
  "유튜브 연동": "studioNav.youtube",
  "영상 목록": "studioNav.videos",
  방송: "studioNav.groupBroadcast",
  "통합 채팅": "studioNav.unifiedChat",
  채팅봇: "studioNav.chatBot",
  위젯: "studioNav.widgets",
  "방송 도구": "studioNav.tools",
  "시청자 참여": "studioNav.play",
  "오버레이 주소": "studioNav.overlays",
  "원소스 배치": "studioNav.oneSource",
  "커스텀 오버레이": "studioNav.customOverlay",
  "외부 프로그램 연동": "studioNav.bridge",
  "이미지·사운드": "studioNav.assets",
  "음악 편집기": "studioNav.music",
  리모컨: "studioNav.remote",
  "크루 방송": "studioNav.groupCrew",
  "크루 관리": "studioNav.crew",
  "방송 운영": "studioNav.crewBroadcast",
  "점수 게임": "studioNav.crewGames",
  수익: "studioNav.groupRevenue",
  "수익 현황": "studioNav.revenue",
  "받은 후원": "studioNav.received",
  "후원 순위": "studioNav.donorRanking",
  "후원 필터링": "studioNav.filtering",
  "내역 이관": "studioNav.import",
  "크리에이터 랭킹": "studioNav.creatorRanking",
  정산: "studioNav.groupSettlement",
  "정산 현황": "studioNav.settlement",
  "정산 인증·등록": "studioNav.settlementRegister",
  "정산 계좌": "studioNav.settlementAccount",
  "방송 설정": "studioNav.broadcastSettings",
  "후원 종류 설정": "studioNav.donationTypes",
  "정산 신청": "studioNav.settlementApply",
  "정산 관리": "studioNav.settlementManage",
  소식: "studioNav.updates",
  "크리에이터 스튜디오": "studioNav.studio"
};

/** The phone dropdown (always in the page, shown by studio.module.css while open on phones). */
export const STUDIO_MENU_ID = "studio-side-menu";

/** `donationTypes` comes from the server (FLEXTV_SSUMNATION_API is a server-only setting). */
export function CreatorSideNav({ donationTypes = false }: { donationTypes?: boolean }) {
  const { t } = useI18n();
  const label = (text: string) => {
    const key = LABEL_KEYS[text];
    return key ? t(key) : text;
  };
  const pathname = usePathname() ?? "/creator";
  const tab = useSearchParams()?.get("tab") ?? null;
  const groups = donationTypes ? studioGroups(FLEXTV_STUDIO, true) : GROUPS;
  const active = studioActiveHref(pathname, tab, groups);
  const current = studioCurrentItem(active, groups);
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
    <nav className={styles.sidebar} aria-label={t("studioNav.menuAria")} data-open={open || undefined} onBlur={onBlur}>
      <button ref={buttonRef} type="button" className={styles.sideToggle} aria-expanded={open} aria-controls={STUDIO_MENU_ID} onClick={() => setOpen((v) => !v)}>
        <span className={styles.sideToggleCurrent}>
          {current.emoji && (
            <span className={styles.sideEmoji} aria-hidden="true">
              {current.emoji}
            </span>
          )}
          <span className={styles.sideToggleLabel}>{label(current.label)}</span>
          {current.inMenu && <span className={styles.srOnly}>{` ${t("studioNav.currentPage")}`}</span>}
        </span>
        <span className={styles.sideToggleMore}>
          {t("studioNav.menu")}
          <span className={styles.sideChevron} aria-hidden="true">
            ▾
          </span>
        </span>
      </button>
      <div className={styles.sideScrim} aria-hidden="true" />
      <div ref={panelRef} id={STUDIO_MENU_ID} className={styles.sideMenu}>
        {groups.map((g, i) => (
          <div key={g.title ?? `g${i}`} className={styles.sideGroup}>
            {g.title && <p className={styles.sideGroupTitle}>{label(g.title)}</p>}
            <ul>
              {g.items.map((item) => {
                const content = (
                  <>
                    <span className={styles.sideEmoji} aria-hidden="true">
                      {item.emoji}
                    </span>
                    {label(item.label)}
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
                      <span className={`${styles.sideItem} ${styles.sideItemOff}`} aria-disabled="true" title={t("common.comingSoon")}>
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
