import Image from "next/image";
import { formatNumber } from "@/lib/format";
import { CREATOR_CATEGORY_LABEL, type CreatorSummary } from "@/services/creators/creators";
import styles from "./creators.module.css";

/** Tag colors follow position, not category, in Figma 690:5 (cyan → purple → pink). */
const TAG_TONES = [styles.tagCyan, styles.tagPurple, styles.tagPink];

/**
 * Figma 690:5 creator card (236.8 × 251).
 * TODO: link to the creator detail page once it exists.
 */
export function CreatorCard({ creator }: { creator: CreatorSummary }) {
  return (
    <article className={styles.card}>
      <span className={`${styles.ring} ${styles[`ring_${creator.ring}`]}`}>
        <Image src={creator.avatarUrl} alt="" width={90} height={90} className={styles.avatar} />
      </span>
      <div className={styles.cardBody}>
        <div className={styles.nameRow}>
          <h2 className={styles.name}>{creator.name}</h2>
          {creator.isNew && <span className={`${styles.badge} ${styles.badgeNew}`}>NEW</span>}
          {creator.isLive && <span className={`${styles.badge} ${styles.badgeLive}`}>LIVE</span>}
        </div>
        <p className={styles.viewers}>
          {creator.isLive && creator.viewerCount !== null ? `현재 시청자 ${formatNumber(creator.viewerCount)}명` : "방송 준비 중"}
        </p>
        <ul className={styles.tags} aria-label="카테고리">
          {creator.categories.map((c, i) => (
            <li key={c} className={TAG_TONES[i % TAG_TONES.length]}>
              {CREATOR_CATEGORY_LABEL[c]}
            </li>
          ))}
        </ul>
      </div>
      <p className={styles.description} title={creator.description}>
        {creator.description}
      </p>
    </article>
  );
}
