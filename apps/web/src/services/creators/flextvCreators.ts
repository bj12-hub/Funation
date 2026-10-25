import { fetchRankedChannels, searchChannels, type FlextvChannelRow } from "@/lib/flextv/channels";
import { getAllLiveChannels, type LiveChannel } from "@/services/live/liveChannels";
import { CREATORS_PAGE_SIZE, type CreatorPage, type CreatorQuery, type CreatorSummary } from "./creators";

/**
 * 크리에이터 찾기 with FLEXTV (phase 7, docs/development/flextv-backend.md "7단계"): FLEXTV's channels, linked to their
 * rooms. 인기순 is FLEXTV's weekly channel ranking, 라이브 its live list by viewers, and a search FLEXTV's 방송국 검색.
 * FLEXTV has no channel categories and no list of new channels, so there is no category filter and no 최신순.
 * ./creators.ts delegates here.
 */

const DEFAULT_AVATAR = "/mock/creators/creator-1.png";
const RANKING_TTL_MS = 60_000;
const rankingCache = globalThis as typeof globalThis & { __ssumnationFlextvRanking?: { at: number; list: Promise<FlextvChannelRow[]> } };

/** One read of FLEXTV's ranking per server a minute (it changes with FLEXTV's ranking batch). */
export function rankedChannels(): Promise<FlextvChannelRow[]> {
  const cached = rankingCache.__ssumnationFlextvRanking;
  if (cached && Date.now() - cached.at < RANKING_TTL_MS) return cached.list;
  const list = fetchRankedChannels();
  rankingCache.__ssumnationFlextvRanking = { at: Date.now(), list };
  list.catch(() => rankingCache.__ssumnationFlextvRanking?.list === list && delete rankingCache.__ssumnationFlextvRanking);
  return list;
}

export function creatorOfChannel(row: FlextvChannelRow, live: Map<string, LiveChannel>): CreatorSummary {
  const now = live.get(row.channelId);
  return {
    id: row.channelId,
    name: row.name,
    avatarUrl: row.thumbUrl ?? DEFAULT_AVATAR,
    description: row.description,
    categories: [],
    isLive: Boolean(now) || row.live,
    isNew: false,
    viewerCount: now ? now.viewerCount : row.live ? row.viewers : null,
    subscriberCount: row.followers,
    joinedAt: "",
    ring: "plain"
  };
}

/** A live channel from the live list (FLEXTV's live list has no 즐겨찾기 count). */
const creatorOfLive = (c: LiveChannel): CreatorSummary => ({
  id: c.id,
  name: c.channelName,
  avatarUrl: c.channelAvatarUrl,
  description: c.title,
  categories: [],
  isLive: true,
  isNew: false,
  viewerCount: c.viewerCount,
  subscriberCount: 0,
  joinedAt: "",
  ring: "plain"
});

export async function flextvCreatorsPage({ query, sort = "popular", page = 1 }: CreatorQuery): Promise<CreatorPage> {
  const keyword = query?.trim();
  const liveList = await getAllLiveChannels();
  const live = new Map(liveList.map((c) => [c.id, c]));
  let items: CreatorSummary[];
  if (keyword) {
    items = (await searchChannels(keyword)).map((row) => creatorOfChannel(row, live));
    if (sort === "live") items = items.filter((c) => c.isLive).sort((a, b) => (b.viewerCount ?? 0) - (a.viewerCount ?? 0));
  } else if (sort === "live") {
    items = liveList.map(creatorOfLive);
  } else {
    items = (await rankedChannels()).map((row) => creatorOfChannel(row, live));
  }
  const totalPages = Math.max(1, Math.ceil(items.length / CREATORS_PAGE_SIZE));
  const current = Math.min(Math.max(1, page), totalPages);
  return {
    items: items.slice((current - 1) * CREATORS_PAGE_SIZE, current * CREATORS_PAGE_SIZE),
    page: current,
    totalPages,
    totalCount: items.length,
    liveCount: liveList.length
  };
}
