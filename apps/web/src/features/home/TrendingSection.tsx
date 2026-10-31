import Image from "next/image";
import Link from "next/link";
import { formatCompact } from "@/lib/format";
import { getLocale, getT } from "@/lib/i18n/server";
import { remote } from "@/lib/remoteImage";
import type { TrendingVideo } from "@/services/home/homeFeed";
import { SectionHeader } from "./SectionHeader";
import styles from "./home.module.css";

/** Figma 727:2773 — 🔥 지금 뜨는 영상 */
export async function TrendingSection({ videos }: { videos: TrendingVideo[] }) {
  const t = await getT();
  const locale = await getLocale();
  return (
    <section className={styles.section} aria-labelledby="home-trending">
      <SectionHeader id="home-trending" title={t("home.trending")} viewAllHref="/live/popular" viewAllLabel={t("home.viewAll")} />
      {videos.length === 0 ? (
        <p className={styles.empty}>{t("home.noTrending")}</p>
      ) : (
        <div className={styles.trendingGrid}>
          {videos.map((video) => (
            <Link key={video.id} href={video.href} className={styles.card}>
              <div className={styles.thumb}>
                <Image src={video.thumbnailUrl} alt="" fill sizes="(max-width: 768px) 100vw, 296px" className={styles.thumbImage} unoptimized={remote(video.thumbnailUrl)} />
                <span className={styles.thumbShade} />
                <span className={`${styles.pillBadge} ${styles.pillStart}`}>{t("home.rank", { n: video.rank })}</span>
                <span className={`${styles.pillBadge} ${styles.pillEnd}`}>{t("home.watching", { count: formatCompact(video.viewerCount, locale) })}</span>
                {video.isLive && <span className={styles.mediaBadge}>LIVE</span>}
              </div>
              <div className={styles.cardText}>
                <h3 className={styles.cardTitle}>{video.title}</h3>
                <div className={styles.cardMeta}>
                  <span>{video.channelName}</span>
                  <span className={styles.cardMetaSub}>{video.isLive ? t("home.liveNow") : t("home.replay")}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
