"use client";

import Image from "next/image";
import Link from "next/link";
import { formatDuration, formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { remote } from "@/lib/remoteImage";
import type { LiveChannel } from "@/services/live/liveChannels";
import styles from "./LiveChannelCard.module.css";

type LiveChannelCardProps = {
  channel: LiveChannel;
  /** `full`: 전체라이브 card (617:438). `compact`: 인기라이브 card (617:107). */
  variant: "full" | "compact";
  sizes: string;
  /** Cards in the first row: load the thumbnail early (it is the page's largest image). */
  priority?: boolean;
};

export function LiveChannelCard({ channel, variant, sizes, priority = false }: LiveChannelCardProps) {
  const { t } = useI18n();
  const full = variant === "full";
  const avatarSize = full ? 36 : 32;

  return (
    <Link href={channel.href} className={`${styles.card} ${styles[variant]}`}>
      <div className={styles.thumb}>
        <Image src={channel.thumbnailUrl} alt="" fill sizes={sizes} priority={priority} className={styles.thumbImage} unoptimized={remote(channel.thumbnailUrl)} />
        <span className={styles.shade} />
        <span className={`${styles.badge} ${styles.live}`}>LIVE</span>
        <span className={`${styles.badge} ${styles.viewers}`}>{t("live.viewers", { count: formatNumber(channel.viewerCount) })}</span>
      </div>
      <div className={styles.info}>
        <Image src={channel.channelAvatarUrl} alt="" width={avatarSize} height={avatarSize} className={styles.avatar} unoptimized={remote(channel.channelAvatarUrl)} />
        <div className={styles.text}>
          <h3 className={styles.title} title={channel.title}>
            {channel.title}
          </h3>
          <div className={styles.meta}>
            <span className={styles.channel}>{channel.channelName}</span>
            {full && <span className={styles.elapsed}>{t("live.onAir", { time: formatDuration(channel.elapsedSeconds) })}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}
