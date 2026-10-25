import Image from "next/image";
import Link from "next/link";
import { FLEXTV_SITE } from "@/lib/flextv/mode";
import { formatCompactKo, formatNumber } from "@/lib/format";
import { remote } from "@/lib/remoteImage";
import type { CreatorSummary } from "@/services/creators/creators";
import styles from "./creatorsDirectory.module.css";

/**
 * 크리에이터 찾기 card — funnation structure (wide card: avatar with LIVE ring, name, 2-line intro,
 * 구독자 · 시청 N). Live creators get the accent border. Links to the creator room.
 */
export function CreatorCard({ creator }: { creator: CreatorSummary }) {
  const live = creator.isLive && creator.viewerCount !== null;
  return (
    <Link href={`/creators/${creator.id}`} className={styles.card} data-live={live || undefined}>
      <span className={styles.avatarWrap}>
        <span className={styles.ring}>
          <Image src={creator.avatarUrl} alt="" width={64} height={64} className={styles.avatar} unoptimized={remote(creator.avatarUrl)} />
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
          {/* With FLEXTV its 즐겨찾기 count (phase 7); its live list has none. */}
          {!(FLEXTV_SITE && live && creator.subscriberCount === 0) && (
            <span>
              {FLEXTV_SITE ? "즐겨찾기" : "구독자"} {formatCompactKo(creator.subscriberCount)}
            </span>
          )}
          {live && <span className={styles.watching}>시청 {formatNumber(creator.viewerCount!)}</span>}
        </span>
      </span>
    </Link>
  );
}
