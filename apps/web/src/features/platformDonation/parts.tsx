"use client";

import Link from "next/link";
import { SearchIcon } from "@/components/icons";
import { ChargeTrigger } from "@/features/walletCharge";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { PLATFORMS, type PlatformCreator, type PlatformKey } from "@/services/platformDonation/platformTypes";
import { PLATFORM_WORDS } from "./words";
import styles from "./platformDonation.module.css";

// Client components (2026-11-01): the donation flow and the server-rendered home · search screens both use them, in the viewer's language.

/** Page title + wallet box (817:9146 header row). The balance is server-provided. */
export function PlatformHeader({ platform, subtitle, balance }: { platform: PlatformKey; subtitle: string; balance: number }) {
  const { t } = useI18n();
  return (
    <header className={styles.header}>
      <div>
        <h1 className={styles.title}>{t("platformDonation.title", { platform: PLATFORMS[platform].name })}</h1>
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
  const { t } = useI18n();
  const p = PLATFORMS[platform];
  const placeholder = t(PLATFORM_WORDS[platform].search);
  return (
    <form className={styles.search} action={`/donation/${p.slug}/search`} role="search">
      <SearchIcon className={styles.searchIcon} aria-hidden="true" />
      <input className={styles.searchInput} name="q" defaultValue={defaultValue} placeholder={placeholder} aria-label={placeholder} maxLength={40} />
      <button type="submit" className={styles.searchButton}>
        {t("common.search")}
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
  const { t } = useI18n();
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
        {t("platformDonation.donate")}
      </Link>
    </li>
  );
}
