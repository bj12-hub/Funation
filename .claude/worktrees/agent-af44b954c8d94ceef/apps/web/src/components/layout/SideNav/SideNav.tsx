"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import {
  AirplayIcon,
  CalendarIcon,
  CommunityOutlineIcon,
  GiftIcon,
  GiftOutlineIcon,
  HeartOutlineIcon,
  HelpCircleIcon,
  HomeIcon,
  MailOutlineIcon,
  ReceiptOutlineIcon,
  SearchOutlineIcon,
  SettingsIcon,
  SmileIcon,
  StarIcon,
  TrendingUpIcon,
  TrophyMarkIcon,
  UserIcon,
  VideoCameraIcon,
  WalletOutlineIcon
} from "@/components/icons";
import { ChargeTrigger, QrChargeTrigger } from "@/features/walletCharge";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import styles from "./SideNav.module.css";

/**
 * Site side menu — structure follows funnation (docs/research/funnation-reference.md §0):
 * profile card + 크리에이터 스튜디오 entry, then 둘러보기 · 후원 · 마이 · 더보기 groups.
 * Rendered on every (main) page by AppShell. Visual styles keep the Figma tokens (sidebar 617:344).
 */

export type SideNavUser = {
  nickname: string;
  funationId: string;
  avatarUrl?: string | null;
  /** Server-provided balance. The client never calculates it. `null` while unknown. */
  fnBalance: number | null;
  /** Has the Creator role (shows 크리에이터 스튜디오; otherwise 내 채널 만들기). */
  creator: boolean;
};

type MenuItem = {
  label: MessageKey;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Items without `href` have no screen yet. */
  href?: string;
  badge?: { text: string; tone: "live" | "event" };
};

type MenuGroup = { title: MessageKey | null; items: MenuItem[]; signedInOnly?: boolean };

const GROUPS: MenuGroup[] = [
  {
    title: null,
    items: [
      { label: "side.home", Icon: HomeIcon, href: "/" },
      { label: "side.allLive", Icon: AirplayIcon, href: "/live", badge: { text: "LIVE", tone: "live" } },
      { label: "side.findCreators", Icon: SearchOutlineIcon, href: "/creators" },
      { label: "side.favorites", Icon: StarIcon, href: "/favorites" },
      { label: "side.community", Icon: CommunityOutlineIcon, href: "/community" }
    ]
  },
  {
    // Our confirmed platforms (CLAUDE.md §9); not in funnation.
    title: "side.groupDonate",
    items: [
      { label: "side.soop", Icon: GiftOutlineIcon, href: "/donation/soop" },
      { label: "side.flextv", Icon: HeartOutlineIcon, href: "/donation/flextv" },
      { label: "side.platformHistory", Icon: ReceiptOutlineIcon, href: "/donation/history" }
    ]
  },
  {
    title: "side.groupMy",
    signedInOnly: true,
    items: [
      { label: "side.myInfo", Icon: UserIcon, href: "/mypage" },
      { label: "side.donationHistory", Icon: GiftIcon, href: "/wallet/donations" },
      { label: "side.wallet", Icon: WalletOutlineIcon, href: "/wallet" },
      { label: "side.messages", Icon: MailOutlineIcon, href: "/messages" },
      { label: "side.titles", Icon: TrophyMarkIcon, href: "/mypage/titles" },
      { label: "side.nicknames", Icon: SmileIcon, href: "/mypage/nicknames" },
      { label: "side.ranking", Icon: TrendingUpIcon, href: "/mypage/ranking" }
    ]
  },
  {
    title: "side.groupMore",
    items: [
      { label: "side.events", Icon: GiftIcon, href: "/events" },
      { label: "side.attendance", Icon: CalendarIcon, href: "/attendance", badge: { text: "EVENT", tone: "event" } },
      { label: "side.hallOfFame", Icon: TrophyMarkIcon, href: "/hall-of-fame" },
      { label: "side.support", Icon: HelpCircleIcon, href: "/support" },
      { label: "side.settings", Icon: SettingsIcon }
    ]
  }
];

const ALL_HREFS = GROUPS.flatMap((g) => g.items.map((i) => i.href)).filter((h): h is string => Boolean(h));

/** The most specific menu href that contains the current path (so /wallet/donations ≠ /wallet). */
export function activeHref(pathname: string) {
  return ALL_HREFS.filter((h) => (h === "/" ? pathname === "/" : pathname === h || pathname.startsWith(`${h}/`))).sort((a, b) => b.length - a.length)[0] ?? null;
}

export function SideNav({ user, onNavigate }: { user: SideNavUser | null; onNavigate?: () => void }) {
  const pathname = usePathname() ?? "/";
  const { t } = useI18n();
  const active = activeHref(pathname);

  return (
    <aside className={styles.sidebar} aria-label={t("side.aside")}>
      <div className={styles.top}>{user ? <ProfileCard user={user} onNavigate={onNavigate} /> : <GuestCard />}</div>

      {user && (
        <div className={styles.charge}>
          <ChargeTrigger className={styles.chargeButton}>{t("side.charge")}</ChargeTrigger>
          <QrChargeTrigger className={styles.outlineButton}>{t("side.qrCharge")}</QrChargeTrigger>
        </div>
      )}

      <nav className={styles.menu} aria-label={t("side.liveMenu")}>
        {GROUPS.filter((g) => user || !g.signedInOnly).map((g, i) => (
          <div key={g.title ?? i} className={styles.group}>
            {g.title && <p className={styles.groupTitle}>{t(g.title)}</p>}
            {g.items.map((item) => (
              <MenuLink key={item.label} item={item} active={item.href === active} onNavigate={onNavigate} />
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}

function MenuLink({ item, active, onNavigate }: { item: MenuItem; active: boolean; onNavigate?: () => void }) {
  const { t } = useI18n();
  const content = (
    <>
      <item.Icon className={styles.menuIcon} />
      <span>{t(item.label)}</span>
      {item.badge && <span className={`${styles.badge} ${styles[item.badge.tone]}`}>{item.badge.text}</span>}
    </>
  );

  if (!item.href) {
    return (
      <span className={`${styles.menuItem} ${styles.menuItemDisabled}`} aria-disabled="true" title={t("common.comingSoon")}>
        {content}
      </span>
    );
  }

  return (
    <Link href={item.href} className={`${styles.menuItem} ${active ? styles.menuItemActive : ""}`} aria-current={active ? "page" : undefined} onClick={onNavigate}>
      {content}
    </Link>
  );
}

function ProfileCard({ user, onNavigate }: { user: SideNavUser; onNavigate?: () => void }) {
  const { t } = useI18n();
  return (
    <section className={styles.card} aria-label={t("side.myInfo")}>
      <div className={styles.profile}>
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- user-supplied avatar from an arbitrary host
          <img className={styles.avatar} src={user.avatarUrl} alt="" width={48} height={48} />
        ) : (
          <span className={`${styles.avatar} ${styles.avatarFallback}`} aria-hidden="true">
            {user.nickname.slice(0, 1)}
          </span>
        )}
        <div className={styles.profileText}>
          <strong className={styles.nickname}>{user.nickname}</strong>
          <span className={styles.idLabel}>{t("side.idLabel")}</span>
          <span className={styles.idValue}>@{user.funationId}</span>
        </div>
      </div>
      <div className={styles.balance}>
        <span>{t("side.balance")}</span>
        <strong>{user.fnBalance === null ? "—" : `${formatNumber(user.fnBalance)} FN`}</strong>
      </div>
      {/* funnation: the studio entry sits right under the profile. Members without the role create a channel first. */}
      <Link href={user.creator ? "/creator" : "/channel/new"} className={styles.studioButton} onClick={onNavigate}>
        <VideoCameraIcon className={styles.menuIcon} aria-hidden="true" />
        {t(user.creator ? "side.creatorStudio" : "side.createChannel")}
      </Link>
    </section>
  );
}

/** Guest state is not in Figma; it keeps the card slot and points to login. */
function GuestCard() {
  const { t } = useI18n();
  return (
    <section className={styles.card} aria-label={t("side.guestInfo")}>
      <p className={styles.guestText}>{t("side.guestText")}</p>
      <Link href="/login" className={styles.loginButton}>
        {t("common.login")}
      </Link>
    </section>
  );
}
