import type { LiveChannel } from "@/services/live/liveChannels";
import { AllLiveBrowser } from "./AllLiveBrowser";
import { LivePageHeader } from "./LivePageHeader";
import { PopularLiveList } from "./PopularLiveSections";
import styles from "./live.module.css";

/** 전체라이브 — Figma 617:316, route `/live` */
export function AllLiveScreen({ channels }: { channels: LiveChannel[] }) {
  return (
    <div className={styles.content}>
      <LivePageHeader active="all" />
      <AllLiveBrowser channels={channels} />
    </div>
  );
}

/** 인기라이브 — Figma 617:5, route `/live/popular` */
export function PopularLiveScreen({ channels }: { channels: LiveChannel[] }) {
  return (
    <div className={styles.content}>
      <LivePageHeader active="popular" />
      <PopularLiveList channels={channels} />
    </div>
  );
}
