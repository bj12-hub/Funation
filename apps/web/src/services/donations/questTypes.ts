import type { QuestStatus } from "@/services/creator/donationManagementTypes";

/**
 * 퀘스트 후원 결과 (code-first). Who decides follows the 결정 권한 table of the quest widget (Figma): the
 * supporter who sent it can always decide; the creator too when "크리에이터 성공 결정" was on. A failed
 * quest refunds the whole amount, and so does a quest the creator cancels (2026-10-04 결정). A quest past its
 * time limit keeps running until someone decides (2026-10-04 결정).
 * Client-safe types only.
 */
export const QUEST_OUTCOMES = ["SUCCESS", "FAILED"] as const;
export type QuestOutcome = (typeof QUEST_OUTCOMES)[number];
export const isQuestOutcome = (v: unknown): v is QuestOutcome => QUEST_OUTCOMES.includes(v as QuestOutcome);

/** What a decider can do: a result, or 취소 (creator only). */
export type QuestAction = QuestOutcome | "CANCELED";
export const isQuestAction = (v: unknown): v is QuestAction => isQuestOutcome(v) || v === "CANCELED";

export type QuestDecideResult =
  | { status: "OK"; questStatus: QuestStatus; refundedFn: number }
  /** Decided before with the other outcome; a result never changes. */
  | { status: "ALREADY_DECIDED"; questStatus: QuestStatus }
  /** The other side decides this quest. */
  | { status: "FORBIDDEN" }
  | { status: "NOT_FOUND" | "INVALID" | "UNAUTHORIZED" };

/** What the supporter's 후원 내역 shows for one of their quests. */
export type QuestView = { status: QuestStatus; canDecide: boolean };

/**
 * A running quest on the 리모컨 퀘스트 card (code-first). Donor and title as 받은 후원 shows them — the original text;
 * the 대체 메시지 rules apply only to what goes on stream. `actions` are the ones 받은 후원 offers for the same quest.
 */
export type QuestRemoteRow = {
  id: string;
  donor: string;
  /** Empty for a hidden profile. */
  donorId: string;
  title: string;
  /** FN held (= 성공 보상). */
  amount: number;
  createdAt: string;
  /** Sent time + time limit; past it the quest still runs until someone decides (2026-10-04 결정). */
  endsAt: string;
  actions: QuestAction[];
};

/** The studio's running quests, oldest first (the order of the 퀘스트 위젯), and the server's clock for 남은 시간. */
export type QuestRemoteView = { quests: QuestRemoteRow[]; serverNow: string };
