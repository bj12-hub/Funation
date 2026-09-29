"use client";

import Link from "next/link";
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
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Items without `href` have no screen yet. */
  href?: string;
  badge?: { text: string; tone: "live" | "event" };
};

const MENU: MenuItem[] = [
  { label: "홈", Icon: HomeIcon, href: "/" },
  // SOOP · FlexTV 머니 후원 (Figma 817:9411 · 817:8761 sidebars).
  { label: "SOOP 후원", Icon: GiftOutlineIcon, href: "/donation/soop" },
  { label: "FlexTV 후원", Icon: HeartOutlineIcon, href: "/donation/flextv" },
  { label: "후원 내역", Icon: ReceiptOutlineIcon, href: "/donation/history" },
  { label: "FN Wallet", Icon: WalletOutlineIcon, href: "/wallet" },
  { label: "쪽지", Icon: MailOutlineIcon, href: "/messages" },
  { label: "커뮤니티", Icon: CommunityOutlineIcon, href: "/community" },
  { label: "추천 라이브", Icon: AirplayIcon, href: "/live", badge: { text: "LIVE", tone: "live" } },
  { label: "즐겨찾기", Icon: StarIcon, href: "/favorites" },
  { label: "출석체크", Icon: CalendarIcon, href: "/attendance", badge: { text: "EVENT", tone: "event" } },
  { label: "실시간 인기 급상승", Icon: TrendingUpIcon, href: "/live/popular" }
];

const WATCH_HISTORY: MenuItem = { label: "시청 기록", Icon: HistoryIcon };
const SETTINGS: MenuItem = { label: "설정", Icon: SettingsIcon };

type SideNavProps = {
  user: SideNavUser | null;
  /** 시청 기록 appears only in the my page variant (735:4119). */
  showWatchHistory?: boolean;
};

export function SideNav({ user, showWatchHistory = false }: SideNavProps) {
  const pathname = usePathname() ?? "/";

  return (
    <aside className={styles.sidebar} aria-label="보조 메뉴">
      {user ? <ProfileCard user={user} /> : <GuestCard />}

      {user && (
        <div className={styles.charge}>
          <ChargeTrigger className={styles.chargeButton} />
          <QrChargeTrigger className={styles.outlineButton} />
        </div>
      )}

      <nav className={styles.menu} aria-label="라이브 메뉴">
        {MENU.map((item) => (
          <MenuLink key={item.label} item={item} active={item.href === pathname || (!!item.href?.startsWith("/donation/") && pathname.startsWith(`${item.href}/`))} />
        ))}
        {showWatchHistory && <MenuLink item={WATCH_HISTORY} active={false} />}
        <hr className={styles.divider} />
        <MenuLink item={SETTINGS} active={false} />
      </nav>
    </aside>
  );
}

function MenuLink({ item, active }: { item: MenuItem; active: boolean }) {
  const content = (
    <>
      <item.Icon className={styles.menuIcon} />
      <span>{item.label}</span>
      {item.badge && <span className={`${styles.badge} ${styles[item.badge.tone]}`}>{item.badge.text}</span>}
    </>
  );

  if (!item.href) {
    return (
      <span className={`${styles.menuItem} ${styles.menuItemDisabled}`} aria-disabled="true" title="준비 중인 기능입니다">
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
  return (
    <section className={styles.card} aria-label="내 정보">
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
          <span className={styles.idLabel}>썸네이션 ID</span>
          <span className={styles.idValue}>@{user.funationId}</span>
        </div>
      </div>
      <div className={styles.balance}>
        <span>현재 보유 FN</span>
        <strong>{user.fnBalance === null ? "—" : `${formatNumber(user.fnBalance)} FN`}</strong>
      </div>
      <div className={styles.cardActions}>
        <Link href="/mypage" className={styles.outlineButton}>
          마이페이지
        </Link>
        <Link href="/wallet/charges" className={styles.outlineButton}>
          FN 내역
        </Link>
      </div>
    </section>
  );
}

/** Guest state is not in Figma; it keeps the card slot and points to login. */
function GuestCard() {
  return (
    <section className={styles.card} aria-label="로그인 안내">
      <p className={styles.guestText}>로그인하면 보유 FN과 후원 내역을 확인할 수 있어요.</p>
      <Link href="/login" className={styles.loginButton}>
        로그인
      </Link>
    </section>
  );
}
