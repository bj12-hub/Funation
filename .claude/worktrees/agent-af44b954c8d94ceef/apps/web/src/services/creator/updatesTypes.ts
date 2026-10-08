/**
 * 업데이트 소식 — code-first, no Figma frame (docs/figma/code-first-screens.md). Reference: funnation
 * 대시보드 "소식" / 업데이트 페이지. Release notes are written by the service team (source: merged work).
 */

export type UpdateItemKind = "NEW" | "IMPROVED" | "FIX";
export const UPDATE_KIND_LABEL: Record<UpdateItemKind, string> = { NEW: "신규", IMPROVED: "개선", FIX: "버그 수정" };

export type UpdatePost = {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  title: string;
  summary: string;
  items: { kind: UpdateItemKind; text: string; href?: string }[];
};

export type UpdatesView = { posts: (UpdatePost & { unread: boolean })[]; unreadCount: number };
