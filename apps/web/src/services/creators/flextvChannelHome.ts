import { kstParts } from "@/lib/format";
import { FLEXTV_WEB_URL } from "@/lib/flextv/mode";
import { fetchFans, fetchNews } from "@/lib/flextv/room";
import { getFlextvAccessToken } from "@/lib/session";
import type { ChannelNews, ChannelRanking } from "./channelTypes";

/**
 * A FLEXTV channel room's 팬 랭킹 and 소식 (phase 9, docs/development/flextv-backend.md "9단계"). Server-only reads;
 * when FLEXTV cannot be read the room still opens, with these marked `unavailable`.
 */

const RANKING_ROWS = 10;

const thisMonth = () => {
  const now = kstParts(new Date());
  return `${now.year}-${String(now.month).padStart(2, "0")}`;
};

/** This month's top fans by what they gave (FLEXTV's order), with their 팬 등급; `viewerLoginId` marks the viewer's row. */
export async function getFlextvChannelRanking(channelId: string, viewerLoginId: string | null): Promise<ChannelRanking> {
  const month = thisMonth();
  try {
    const fans = await fetchFans(channelId, RANKING_ROWS);
    return {
      month,
      source: "FLEXTV",
      rows: fans.map((fan, i) => ({ rank: i + 1, name: fan.nickname, fnAmount: null, level: fan.levelName, me: viewerLoginId !== null && fan.loginId === viewerLoginId }))
    };
  } catch {
    return { month, source: "FLEXTV", rows: [], unavailable: true };
  }
}

/** The channel's latest `count` 소식, each linking to its page on FLEXTV. */
export async function getFlextvChannelNews(channelId: string, count: number): Promise<ChannelNews> {
  try {
    // One more than shown tells whether there are more.
    const items = await fetchNews(channelId, count + 1, (await getFlextvAccessToken()) ?? undefined);
    return {
      items: items.slice(0, count).map((item) => ({ ...item, href: `${FLEXTV_WEB_URL}/channels/${channelId}/feeds/${item.id}` })),
      hasMore: items.length > count,
      unavailable: false
    };
  } catch {
    return { items: [], hasMore: false, unavailable: true };
  }
}
