import type { LiveChannel } from "@/services/live/liveChannels";
import { LiveChannelCard } from "./LiveChannelCard";
import styles from "./live.module.css";

/**
 * 인기라이브 (route `/live/popular`) — one list of the most watched live channels.
 * Figma 617:102 splits this into category sections; categories were dropped (2026-10-02 product decision).
 */
export function PopularLiveList({ channels }: { channels: LiveChannel[] }) {
  if (channels.length === 0) {
    return <p className={styles.empty}>지금 추천할 라이브 방송이 없습니다.</p>;
  }
  return (
    <section className={styles.popularSection} aria-labelledby="popular-live">
      <h2 id="popular-live" className={styles.sectionTitle}>
        지금 가장 많이 보는 라이브
      </h2>
      <div className={styles.popularGrid}>
        {channels.map((c, i) => (
          <LiveChannelCard key={c.id} channel={c} variant="compact" sizes="(max-width: 1200px) 50vw, 263px" priority={i < 4} />
        ))}
      </div>
    </section>
  );
}
