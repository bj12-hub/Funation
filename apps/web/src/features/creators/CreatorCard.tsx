import Image from "next/image";
import Link from "next/link";
import { formatNumber } from "@/lib/format";
import type { CreatorSummary } from "@/services/creators/creators";
import styles from "./creatorsDirectory.module.css";

/**
 * 크리에이터 찾기 card — funnation structure (wide card: avatar with LIVE ring, name, 2-line intro,
 * 구독자 · 시청 N). Live creators get the accent border. Links to the creator room.
 */
/** `labels`: 구독자 · 시청 in the viewer's language (the page passes them). */
export function CreatorCard({ creator, labels }: { creator: CreatorSummary; labels: { subscribers: (count: number) => string; watching: (count: string) => string } }) {
  const live = creator.isLive && creator.viewerCount !== null;
  return (
    <Link href={`/creators/${creator.id}`} className={styles.card} data-live={live || undefined}>
      <span className={styles.avatarWrap}>
        <span className={styles.ring}>
          <Image src={creator.avatarUrl} alt="" width={64} height={64} className={styles.avatar} />
        </span>
        {live && <span className={styles.liveTag}>LIVE</span>}
      </span>
      <span className={styles.body}>
        <span className={styles.nameRow}>
          <strong className={styles.name}>{creator.name}</strong>
          {creator.isNew && <span className={styles.newTag}>NEW</span>}
        </span>
        <span className={styles.intro} title={creator.description}>
          {creator.description}
        </span>
        <span className={styles.meta}>
          <span>{labels.subscribers(creator.subscriberCount)}</span>
          {live && <span className={styles.watching}>{labels.watching(formatNumber(creator.viewerCount!))}</span>}
        </span>
      </span>
    </Link>
  );
}
