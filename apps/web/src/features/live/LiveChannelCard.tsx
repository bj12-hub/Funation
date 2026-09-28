import Image from "next/image";
import Link from "next/link";
import { formatDuration, formatNumber } from "@/lib/format";
import { LIVE_CATEGORY_LABEL, type LiveChannel } from "@/services/live/liveChannels";
import styles from "./LiveChannelCard.module.css";

type LiveChannelCardProps = {
  channel: LiveChannel;
  /** `full`: 전체라이브 card (617:438). `compact`: 인기라이브 card (617:107). */
  variant: "full" | "compact";
  sizes: string;
};

export function LiveChannelCard({ channel, variant, sizes }: LiveChannelCardProps) {
  const full = variant === "full";
  const avatarSize = full ? 36 : 32;

  return (
    <Link href={channel.href} className={`${styles.card} ${styles[variant]}`}>
      <div className={styles.thumb}>
        <Image src={channel.thumbnailUrl} alt="" fill sizes={sizes} className={styles.thumbImage} />
        <span className={styles.shade} />
        <span className={`${styles.badge} ${styles.live}`}>LIVE</span>
        <span className={`${styles.badge} ${styles.viewers}`}>시청자 {formatNumber(channel.viewerCount)}명</span>
        {full && <span className={`${styles.badge} ${styles.category}`}>{LIVE_CATEGORY_LABEL[channel.category]}</span>}
      </div>
      <div className={styles.info}>
        <Image src={channel.channelAvatarUrl} alt="" width={avatarSize} height={avatarSize} className={styles.avatar} />
        <div className={styles.text}>
          <h3 className={styles.title} title={channel.title}>
            {channel.title}
          </h3>
          <div className={styles.meta}>
            <span className={styles.channel}>{channel.channelName}</span>
            {full && <span className={styles.elapsed}>생방송 중 • {formatDuration(channel.elapsedSeconds)}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}
