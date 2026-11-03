import type { FlextvChannelRow } from "@/lib/flextv/channels";
import { FLEXTV_DEFAULT_AVATAR } from "@/lib/flextv/placeholders";
import { rankedChannels } from "@/services/creators/flextvCreators";
import { getAllLiveChannels, type LiveChannel } from "@/services/live/liveChannels";
import type { HeroSlide, HomeFeed, PopularCreator, TrendingVideo } from "./homeFeed";

/**
 * The home with FLEXTV (phase 7, docs/development/flextv-backend.md "7단계"): the banner and 인기 라이브 영상 are FLEXTV's
 * most watched live streams, the 인기 크리에이터 strip its weekly channel ranking. Ssumnation's promotion and arrival
 * notices are its own content and are not shown. ./homeFeed.ts delegates here.
 */

const HERO_COUNT = 5;
const TRENDING_COUNT = 8;
const CREATOR_COUNT = 10;
const FLEXTV_LOGO = "/mock/room/logo-flextv.png";

export const heroSlideOf = (c: LiveChannel): HeroSlide => ({
  id: c.id,
  imageUrl: c.thumbnailUrl,
  badge: "LIVE",
  title: c.title,
  description: c.channelName,
  viewerCount: c.viewerCount,
  href: c.href
});

export const trendingOf = (c: LiveChannel, index: number): TrendingVideo => ({
  id: c.id,
  rank: index + 1,
  thumbnailUrl: c.thumbnailUrl,
  title: c.title,
  channelName: c.channelName,
  viewerCount: c.viewerCount,
  isLive: true,
  href: c.href
});

export const popularCreatorOf = (row: FlextvChannelRow): PopularCreator => ({
  id: row.channelId,
  name: row.name,
  avatarUrl: row.thumbUrl ?? FLEXTV_DEFAULT_AVATAR,
  subscriberCount: row.followers,
  href: `/creators/${row.channelId}`,
  profile: { verified: false, status: row.description, tags: [], channels: [{ platform: "FLEXTV", logoUrl: FLEXTV_LOGO }] }
});

export async function flextvHomeFeed(): Promise<HomeFeed> {
  // The live list is ordered by viewers; a failed ranking leaves the strip empty rather than the whole home.
  const [live, ranked] = await Promise.all([getAllLiveChannels(), rankedChannels().catch((): FlextvChannelRow[] => [])]);
  return {
    heroSlides: live.slice(0, HERO_COUNT).map(heroSlideOf),
    trending: live.slice(0, TRENDING_COUNT).map(trendingOf),
    creators: ranked.slice(0, CREATOR_COUNT).map(popularCreatorOf),
    promotion: null,
    notices: []
  };
}
