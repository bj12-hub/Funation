/** 콘텐츠 관리 (공지 · FAQ) — code-first. Client-safe limits and result types. */

export const NOTICE_LIMITS = { title: 80, summary: 200, body: 5_000 } as const;
export const FAQ_LIMITS = { question: 120, answer: 1_000, linkLabel: 20 } as const;

export type ContentResult = { status: "OK"; id: string } | { status: "INVALID"; message: string } | { status: "NOT_FOUND" | "UNAUTHORIZED" };
