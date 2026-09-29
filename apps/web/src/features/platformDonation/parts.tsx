import Link from "next/link";
import { SearchIcon } from "@/components/icons";
import { ChargeTrigger } from "@/features/walletCharge";
import { formatNumber } from "@/lib/format";
import { PLATFORMS, type PlatformCreator, type PlatformKey } from "@/services/platformDonation/platformTypes";
import styles from "./platformDonation.module.css";

/** Page title + wallet box (817:9146 header row). The balance is server-provided. */
export function PlatformHeader({ platform, subtitle, balance }: { platform: PlatformKey; subtitle: string; balance: number }) {
  return (
    <header className={styles.header}>
      <div>
        <h1 className={styles.title}>{PLATFORMS[platform].name} 후원</h1>
        <p className={styles.subtitle}>{subtitle}</p>
      </div>
      <div className={styles.wallet}>
        <span className={styles.walletAmount}>{formatNumber(balance)} FN</span>
        <ChargeTrigger className={styles.chargeButton} />
      </div>
    </header>
  );
}

export function SearchForm({ platform, defaultValue = "" }: { platform: PlatformKey; defaultValue?: string }) {
  const p = PLATFORMS[platform];
  return (
    <form className={styles.search} action={`/donation/${p.slug}/search`} role="search">
      <SearchIcon className={styles.searchIcon} aria-hidden="true" />
      <input className={styles.searchInput} name="q" defaultValue={defaultValue} placeholder={p.searchPlaceholder} aria-label={p.searchPlaceholder} maxLength={40} />
      <button type="submit" className={styles.searchButton}>
        검색
      </button>
    </form>
  );
}

export function LivePill({ live }: { live: boolean }) {
  return (
    <span className={styles.pill} data-live={live || undefined}>
      {live ? "LIVE" : "OFFLINE"}
    </span>
  );
}

export function Avatar({ creator, size = 44 }: { creator: PlatformCreator; size?: number }) {
  return <span className={styles.avatar} style={{ width: size, height: size, background: creator.avatarColor }} aria-hidden="true" />;
}

/** Streamer / host row (817:9146 result card) linking to the detail + product step. */
export function CreatorRow({ platform, creator }: { platform: PlatformKey; creator: PlatformCreator }) {
  return (
    <li className={styles.creatorRow}>
      <Avatar creator={creator} />
      <span className={styles.creatorText}>
        <span className={styles.creatorName}>
          {creator.nickname} <LivePill live={creator.live} />
        </span>
        <span className={styles.muted}>{creator.handle}</span>
        <span className={styles.muted}>{creator.statusText}</span>
      </span>
      <Link href={`/donation/${PLATFORMS[platform].slug}/${creator.id}`} className={styles.rowButton}>
        후원하기
      </Link>
    </li>
  );
}
