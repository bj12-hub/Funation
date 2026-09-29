"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import { AirplayIcon, CalendarIcon, CommunityOutlineIcon, GiftOutlineIcon, HeartOutlineIcon, HistoryIcon, HomeIcon, MailOutlineIcon, ReceiptOutlineIcon, SettingsIcon, StarIcon, TrendingUpIcon, WalletOutlineIcon } from "@/components/icons";
import { formatNumber } from "@/lib/format";
import { ChargeTrigger, QrChargeTrigger } from "@/features/walletCharge";
import styles from "./SideNav.module.css";

/**
 * Left navigation used by the live pages and my page.
 * Figma: sidebar 617:344 (active "추천 라이브") · 617:33 (active "실시간 인기 급상승") · 735:4119 (with "시청 기록")
 */

export type SideNavUser = {
  nickname: string;
  funationId: string;
  avatarUrl?: string | null;
  /** Server-provided balance. The client never calculates it. `null` while unknown. */
  fnBalance: number | null;
};

type MenuItem = {
  label: MessageKey;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Items without `href` have no screen yet. */
  href?: string;
  badge?: { text: string; tone: "live" | "event" };
};

const MENU: MenuItem[] = [
  { label: "side.home", Icon: HomeIcon, href: "/" },
  // SOOP · FlexTV 머니 후원 (Figma 817:9411 · 817:8761 sidebars).
  { label: "side.soop", Icon: GiftOutlineIcon, href: "/donation/soop" },
  { label: "side.flextv", Icon: HeartOutlineIcon, href: "/donation/flextv" },
  { label: "side.donationHistory", Icon: ReceiptOutlineIcon, href: "/donation/history" },
  { label: "side.wallet", Icon: WalletOutlineIcon, href: "/wallet" },
  { label: "side.messages", Icon: MailOutlineIcon, href: "/messages" },
  { label: "side.community", Icon: CommunityOutlineIcon, href: "/community" },
  { label: "side.recommendedLive", Icon: AirplayIcon, href: "/live", badge: { text: "LIVE", tone: "live" } },
  { label: "side.favorites", Icon: StarIcon, href: "/favorites" },
  { label: "side.attendance", Icon: CalendarIcon, href: "/attendance", badge: { text: "EVENT", tone: "event" } },
  { label: "side.trending", Icon: TrendingUpIcon, href: "/live/popular" }
];

const WATCH_HISTORY: MenuItem = { label: "side.watchHistory", Icon: HistoryIcon };
const SETTINGS: MenuItem = { label: "side.settings", Icon: SettingsIcon };

type SideNavProps = {
  user: SideNavUser | null;
  /** 시청 기록 appears only in the my page variant (735:4119). */
  showWatchHistory?: boolean;
};

export function SideNav({ user, showWatchHistory = false }: SideNavProps) {
  const pathname = usePathname() ?? "/";
  const { t } = useI18n();

  return (
    <aside className={styles.sidebar} aria-label={t("side.aside")}>
      {user ? <ProfileCard user={user} /> : <GuestCard />}

      {user && (
        <div className={styles.charge}>
          <ChargeTrigger className={styles.chargeButton}>{t("side.charge")}</ChargeTrigger>
          <QrChargeTrigger className={styles.outlineButton}>{t("side.qrCharge")}</QrChargeTrigger>
        </div>
      )}

      <nav className={styles.menu} aria-label={t("side.liveMenu")}>
        {MENU.map((item) => (
          <MenuLink key={item.href ?? item.label} item={item} active={item.href === pathname || (!!item.href?.startsWith("/donation/") && pathname.startsWith(`${item.href}/`))} />
        ))}
        {showWatchHistory && <MenuLink item={WATCH_HISTORY} active={false} />}
        <hr className={styles.divider} />
        <MenuLink item={SETTINGS} active={false} />
      </nav>
    </aside>
  );
}

function MenuLink({ item, active }: { item: MenuItem; active: boolean }) {
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
    <Link href={item.href} className={`${styles.menuItem} ${active ? styles.menuItemActive : ""}`} aria-current={active ? "page" : undefined}>
      {content}
    </Link>
  );
}

function ProfileCard({ user }: { user: SideNavUser }) {
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
      <div className={styles.cardActions}>
        <Link href="/mypage" className={styles.outlineButton}>
          {t("common.myPage")}
        </Link>
        <Link href="/wallet/charges" className={styles.outlineButton}>
          {t("side.fnHistory")}
        </Link>
      </div>
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
