import type { LiveCategory, LiveChannel, PopularLiveSection } from "@/services/live/liveChannels";
import { AllLiveBrowser } from "./AllLiveBrowser";
import { LivePageHeader } from "./LivePageHeader";
import { PopularLiveSections } from "./PopularLiveSections";
import styles from "./live.module.css";

/** 전체라이브 — Figma 617:316, route `/live` */
export function AllLiveScreen({ channels, initialCategory }: { channels: LiveChannel[]; initialCategory?: LiveCategory }) {
  return (
    <div className={styles.content}>
      <LivePageHeader active="all" />
      <AllLiveBrowser channels={channels} initialCategory={initialCategory} />
    </div>
  );
}

/** 인기라이브 — Figma 617:5, route `/live/popular` */
export function PopularLiveScreen({ sections }: { sections: PopularLiveSection[] }) {
  return (
    <div className={styles.content}>
      <LivePageHeader active="popular" />
      <PopularLiveSections sections={sections} />
    </div>
  );
}
