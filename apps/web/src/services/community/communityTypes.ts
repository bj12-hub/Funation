/**
 * 커뮤니티 게시판 — code-first, no Figma frame (docs/figma/code-first-screens.md).
 * Reference: docs/research/funnation-reference.md §1. Moderation (reports, hiding, bans), images,
 * notice pinning and retention are TBD.
 */

export const BOARD_CATEGORIES = [
  { key: "FREE", label: "자유" },
  { key: "TIP", label: "팁/공략" },
  { key: "QNA", label: "질문" },
  { key: "BUG", label: "버그" },
  { key: "BRAG", label: "자랑" }
] as const;
export type BoardCategory = (typeof BOARD_CATEGORIES)[number]["key"];
export const isBoardCategory = (v: unknown): v is BoardCategory => BOARD_CATEGORIES.some((c) => c.key === v);
export const categoryLabel = (c: BoardCategory) => BOARD_CATEGORIES.find((x) => x.key === c)!.label;

export const TITLE_MAX = 60;
export const BODY_MAX = 3000;
export const COMMENT_MAX = 300;
export const POSTS_PAGE_SIZE = 15;

export type PostSummary = { id: string; category: BoardCategory; title: string; authorName: string; createdAt: string; commentCount: number; views: number };
/** `byPostAuthor`: written by the post's author (blocking them hides the whole post, so the page is left). */
export type Comment = { id: string; authorName: string; body: string; createdAt: string; mine: boolean; byPostAuthor: boolean };
export type PostDetail = PostSummary & { body: string; mine: boolean; comments: Comment[]; updatedAt: string | null };

export type BoardView = { category: BoardCategory | "ALL"; q: string; items: PostSummary[]; page: number; totalPages: number; total: number };

/** What an empty list says: a search that found nothing is not an empty board. */
export const boardEmptyText = (q: string) =>
  q ? { title: "검색 결과가 없어요.", hint: "다른 검색어로 찾아보세요." } : { title: "아직 게시글이 없어요.", hint: "첫 번째 글을 작성해 보세요!" };

export type PostSaveResult = { status: "SAVED"; id: string } | { status: "INVALID"; message: string } | { status: "NOT_FOUND" | "FORBIDDEN" | "UNAUTHORIZED" };
export type CommentResult = { status: "SAVED" } | { status: "INVALID"; message: string } | { status: "NOT_FOUND" | "FORBIDDEN" | "UNAUTHORIZED" };
