import type { QuestStatus } from "@/services/creator/donationManagementTypes";

/**
 * 퀘스트 후원 결과 (code-first). Who decides follows the 결정 권한 table of the quest widget (Figma): the
 * supporter who sent it can always decide; the creator too when "크리에이터 성공 결정" was on. A failed
 * quest refunds the whole amount (2026-10-04 결정).
 * Client-safe types only.
 */
export const QUEST_OUTCOMES = ["SUCCESS", "FAILED"] as const;
export type QuestOutcome = (typeof QUEST_OUTCOMES)[number];
export const isQuestOutcome = (v: unknown): v is QuestOutcome => QUEST_OUTCOMES.includes(v as QuestOutcome);

export type QuestDecideResult =
  | { status: "OK"; questStatus: QuestStatus; refundedFn: number }
  /** Decided before with the other outcome; a result never changes. */
  | { status: "ALREADY_DECIDED"; questStatus: QuestStatus }
  /** The other side decides this quest. */
  | { status: "FORBIDDEN" }
  | { status: "NOT_FOUND" | "INVALID" | "UNAUTHORIZED" };

/** What the supporter's 후원 내역 shows for one of their quests. */
export type QuestView = { status: QuestStatus; canDecide: boolean };
