/**
 * Client-safe creator directory labels and types. Kept apart from ./creators.ts, which imports server-only mock
 * stores (member status, account data): a client component that needs a label imports it from here, so those
 * stores never reach the browser bundle.
 */

export type CreatorCategory = "VARIETY" | "TRAVEL" | "DRAMA" | "SPORTS" | "MUSIC" | "GAME" | "MUKBANG" | "DAILY";

/** Tab order and labels from Figma 690:5 category tabs. */
export const CREATOR_CATEGORY_LABEL: Record<CreatorCategory, string> = {
  VARIETY: "예능",
  TRAVEL: "여행",
  DRAMA: "드라마",
  SPORTS: "스포츠",
  MUSIC: "뮤직",
  GAME: "게임",
  MUKBANG: "먹방",
  DAILY: "일상"
};

/**
 * Sort options follow funnation 크리에이터 찾기 (인기순 · 라이브 · 최신순).
 * 인기순 = subscribers (TBD: a site follower count once follows exist); 라이브 = only live creators by
 * viewers; 최신순 = most recently joined.
 */
export type CreatorSort = "popular" | "live" | "recent";

export const CREATOR_SORT_LABEL: Record<CreatorSort, string> = {
  popular: "인기순",
  live: "라이브",
  recent: "최신순"
};
