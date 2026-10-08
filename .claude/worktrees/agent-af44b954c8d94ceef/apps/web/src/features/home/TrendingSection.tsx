import Image from "next/image";
import Link from "next/link";
import { formatCompactKo } from "@/lib/format";
import type { TrendingVideo } from "@/services/home/homeFeed";
import { SectionHeader } from "./SectionHeader";
import styles from "./home.module.css";

/** Figma 727:2773 — 🔥 지금 뜨는 영상 */
export function TrendingSection({ videos }: { videos: TrendingVideo[] }) {
  return (
    <section className={styles.section} aria-labelledby="home-trending">
      <SectionHeader id="home-trending" title="인기 라이브 영상 모음" viewAllHref="/live/popular" />
      {videos.length === 0 ? (
        <p className={styles.empty}>지금 뜨는 영상이 없습니다.</p>
      ) : (
        <div className={styles.trendingGrid}>
          {videos.map((video) => (
            <Link key={video.id} href={video.href} className={styles.card}>
              <div className={styles.thumb}>
                <Image src={video.thumbnailUrl} alt="" fill sizes="(max-width: 768px) 100vw, 296px" className={styles.thumbImage} />
                <span className={styles.thumbShade} />
                <span className={`${styles.pillBadge} ${styles.pillStart}`}>{video.rank}위</span>
                <span className={`${styles.pillBadge} ${styles.pillEnd}`}>{formatCompactKo(video.viewerCount)} 명 시청중</span>
                {video.isLive && <span className={styles.mediaBadge}>LIVE</span>}
              </div>
              <div className={styles.cardText}>
                <h3 className={styles.cardTitle}>{video.title}</h3>
                <div className={styles.cardMeta}>
                  <span>{video.channelName}</span>
                  <span className={styles.cardMetaSub}>{video.isLive ? "현재 라이브 중" : "다시보기"}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
