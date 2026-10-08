/**
 * 채널 홈 보강 — code-first (funnation channel home: 월간 후원 랭킹, 채널 커뮤니티). Client-safe types.
 * Ranking rules (what counts, ties, hidden supporters) and community moderation are TBD.
 */

export type ChannelRankRow = { rank: number; name: string; fnAmount: number; me: boolean };

export type ChannelRanking = { month: string; rows: ChannelRankRow[] };

export const CHANNEL_POST_MAX = 500;
export const CHANNEL_POSTS_PAGE = 10;

export type ChannelPost = { id: string; authorName: string; body: string; createdAt: string; mine: boolean };

export type ChannelPostsView = { items: ChannelPost[]; total: number; hasMore: boolean };

export type ChannelPostResult = { status: "SAVED"; id: string } | { status: "DELETED" } | { status: "INVALID"; message: string } | { status: "NOT_FOUND" | "FORBIDDEN" | "UNAUTHORIZED" };
