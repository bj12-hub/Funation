import type { HomeFeed } from "@/services/home/homeFeed";
import type { LiveChannel } from "@/services/live/liveChannels";
import { CreatorStrip } from "./CreatorStrip";
import { HeroCarousel } from "./HeroCarousel";
import { HomeLiveTabs } from "./HomeLiveTabs";
import { HomeNotices } from "./HomeNotices";
import { PromoBanner } from "./PromoBanner";
import { TrendingSection } from "./TrendingSection";
import styles from "./home.module.css";

/**
 * Home screen — section order follows funnation (docs/architecture/information-architecture.md):
 * 인기 크리에이터 strip → banner → 전체 방송 (인기 라이브 / 전체 라이브) →
 * 인기 라이브 영상 모음 → promotion. Card and banner visuals keep the Figma components
 * (funation-videos-page 727:2742). Popups: 크리에이터 프로필 688:646 · arrival notices 200:115 · 200:223.
 */
export function HomeScreen({ feed, liveChannels }: { feed: HomeFeed; liveChannels: LiveChannel[] }) {
  return (
    <>
      <h1 className={styles.srOnly}>썸네이션 홈</h1>
      <CreatorStrip creators={feed.creators} />
      <HeroCarousel slides={feed.heroSlides} />
      <HomeLiveTabs channels={liveChannels} />
      <TrendingSection videos={feed.trending} />
      {feed.promotion && <PromoBanner promotion={feed.promotion} />}
      <HomeNotices notices={feed.notices} />
    </>
  );
}
