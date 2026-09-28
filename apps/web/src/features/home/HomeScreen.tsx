import type { HomeFeed } from "@/services/home/homeFeed";
import { HeroCarousel } from "./HeroCarousel";
import { LiveBrowser } from "./LiveBrowser";
import { LiveRankingSection } from "./LiveRankingSection";
import { PopularCreatorsSection } from "./PopularCreatorsSection";
import { PromoBanner } from "./PromoBanner";
import { TrendingSection } from "./TrendingSection";
import styles from "./home.module.css";

/**
 * Home screen.
 * Figma: funation-videos-page 727:2742 (route `/`, all roles incl. guests)
 */
export function HomeScreen({ feed }: { feed: HomeFeed }) {
  return (
    <>
      <h1 className={styles.srOnly}>Funation 홈</h1>
      <HeroCarousel slides={feed.heroSlides} />
      <TrendingSection videos={feed.trending} />
      <LiveRankingSection items={feed.ranking} />
      <PopularCreatorsSection creators={feed.creators} />
      {feed.promotion && <PromoBanner promotion={feed.promotion} />}
      <LiveBrowser broadcasts={feed.liveBroadcasts} />
    </>
  );
}
