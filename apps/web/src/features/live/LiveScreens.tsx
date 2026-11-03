import type { LiveChannel } from "@/services/live/liveChannels";
import { AllLiveBrowser } from "./AllLiveBrowser";
import { LivePageHeader } from "./LivePageHeader";
import { PopularLiveList } from "./PopularLiveSections";
import styles from "./live.module.css";

/** 전체라이브 — Figma 617:316, route `/live`. `byCategory` (FLEXTV, phase 10): 방송 카테고리 chips and a sort. */
export function AllLiveScreen({ channels, byCategory = false, initialCategory = null }: { channels: LiveChannel[]; byCategory?: boolean; initialCategory?: string | null }) {
  return (
    <div className={styles.content}>
      <LivePageHeader active="all" />
      <AllLiveBrowser channels={channels} byCategory={byCategory} initialCategory={initialCategory} />
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
