/**
 * 채널 홈 보강 — code-first (funnation channel home: 월간 후원 랭킹, 채널 커뮤니티). Client-safe types.
 * Ranking rules (what counts, ties, hidden supporters) and community moderation are TBD.
 */

/** `fnAmount` null: the amount is not shown (a FLEXTV channel's 팬 랭킹 shows the fan's 팬 등급, `level`, instead). */
export type ChannelRankRow = { rank: number; name: string; fnAmount: number | null; level?: string; me: boolean };

/** `source` FLEXTV: the channel's 팬 랭킹 on FLEXTV (phase 9); `unavailable`: FLEXTV could not be read. */
export type ChannelRanking = { month: string; rows: ChannelRankRow[]; source?: "FLEXTV"; unavailable?: boolean };

/** A FLEXTV channel's 소식 (phase 9) as FLEXTV's channel page lists it; each one opens on FLEXTV (`href`). */
export type ChannelNewsItem = { id: string; title: string; imageUrl: string | null; important: boolean; adult: boolean; createdAt: string; views: number; href: string };

export type ChannelNews = { items: ChannelNewsItem[]; hasMore: boolean; unavailable: boolean };

/** How many 소식 the 소식 tab shows at first, and how many more "더 보기" adds. */
export const CHANNEL_NEWS_PAGE = 12;
/** The most 소식 the tab shows ("더 보기" stops there). */
export const CHANNEL_NEWS_MAX = 60;

export const CHANNEL_POST_MAX = 500;
export const CHANNEL_POSTS_PAGE = 10;

export type ChannelPost = { id: string; authorName: string; body: string; createdAt: string; mine: boolean };

export type ChannelPostsView = { items: ChannelPost[]; total: number; hasMore: boolean };

export type ChannelPostResult = { status: "SAVED"; id: string } | { status: "DELETED" } | { status: "INVALID"; message: string } | { status: "NOT_FOUND" | "FORBIDDEN" | "UNAUTHORIZED" };
