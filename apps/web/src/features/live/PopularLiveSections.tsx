import { getT } from "@/lib/i18n/server";
import type { LiveChannel } from "@/services/live/liveChannels";
import { LiveChannelCard } from "./LiveChannelCard";
import styles from "./live.module.css";

/**
 * 인기라이브 (route `/live/popular`) — one list of the most watched live channels.
 * Figma 617:102 splits this into category sections; categories were dropped (2026-10-02 product decision).
 */
export async function PopularLiveList({ channels }: { channels: LiveChannel[] }) {
  const t = await getT();
  if (channels.length === 0) {
    return <p className={styles.empty}>{t("live.popularEmpty")}</p>;
  }
  return (
    <section className={styles.popularSection} aria-labelledby="popular-live">
      <h2 id="popular-live" className={styles.sectionTitle}>
        {t("live.mostWatched")}
      </h2>
      <div className={styles.popularGrid}>
        {channels.map((c, i) => (
          <LiveChannelCard key={c.id} channel={c} variant="compact" sizes="(max-width: 1200px) 50vw, 263px" priority={i < 4} />
        ))}
      </div>
    </section>
  );
}
