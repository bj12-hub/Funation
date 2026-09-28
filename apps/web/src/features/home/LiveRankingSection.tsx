import Image from "next/image";
import Link from "next/link";
import { PlayOutlineIcon } from "@/components/icons";
import { formatNumber } from "@/lib/format";
import type { RankedLive } from "@/services/home/homeFeed";
import { SectionHeader } from "./SectionHeader";
import styles from "./home.module.css";

/** Ranks 1–3 use the pink badge in Figma; the rest are grey. */
const TOP_RANKS = 3;

/** Figma 727:2846 — 🏆 LIVE 시청자 수 랭킹 TOP 5 */
export function LiveRankingSection({ items }: { items: RankedLive[] }) {
  return (
    <section className={styles.section} aria-labelledby="home-ranking">
      <SectionHeader id="home-ranking" title="🏆 LIVE 시청자 수 랭킹 TOP 5" aside="실시간 순위 · 클릭 시 라이브 방송으로 바로 이동" />
      {items.length === 0 ? (
        <p className={styles.empty}>진행 중인 라이브 방송이 없습니다.</p>
      ) : (
        <ol className={styles.rankingList}>
          {items.map((item) => (
            <li key={item.id}>
              <Link href={item.href} className={styles.rankingRow}>
                <span className={`${styles.rank} ${item.rank <= TOP_RANKS ? styles.rankTop : ""}`} aria-label={`${item.rank}위`}>
                  {item.rank}
                </span>
                <span className={styles.rankingThumb}>
                  <Image src={item.thumbnailUrl} alt="" fill sizes="140px" className={styles.thumbImage} />
                  <span className={styles.rankingLive}>LIVE</span>
                </span>
                <span className={styles.rankingText}>
                  <span className={styles.rankingTitle}>{item.title}</span>
                  <span className={styles.rankingChannel}>{item.channelName}</span>
                </span>
                <span className={styles.rankingStats}>
                  <span className={styles.viewers}>
                    <span className={styles.viewersCount}>{formatNumber(item.viewerCount)}명</span>
                    <span className={styles.viewersLabel}>현재 시청자</span>
                  </span>
                  <PlayOutlineIcon />
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
