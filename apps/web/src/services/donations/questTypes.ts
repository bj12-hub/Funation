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

/**
 * 제한 시간 연장 (2026-10-18 결정, 퀘스트 위젯 "제한시간 연장 사용"): the creator adds whole minutes to a running quest from the
 * 리모컨 퀘스트 card, 1~60 per extension — the same unit cap as the time limit a supporter can set (donation catalog
 * `game.maxTimeSec` = 3,600 s, itself an assumption · TBD). Before its deadline the minutes are added to the deadline; a quest
 * already past it (시간 초과 · 결과 대기, still running — 2026-10-04 결정) gets a new deadline counted from now. How many times
 * and how long in total: TBD (no cap).
 */
export const QUEST_EXTEND_MINUTES = { min: 1, max: 60 } as const;

/** Said by the server and by the 리모컨 before it sends (whole minutes only). */
export const QUEST_EXTEND_BOUNDS_TEXT = `연장 시간은 ${QUEST_EXTEND_MINUTES.min}~${QUEST_EXTEND_MINUTES.max}분으로 입력해 주세요.`;

/** "연장됨 +10분" — next to every deadline or time left of an extended quest. */
export const questExtendedLabel = (minutes: number) => `연장됨 +${minutes}분`;

export type QuestExtendResult =
  /** `endsAt`: the new deadline. `restarted`: the quest was past its deadline, so it counts from the extension. */
  | { status: "OK"; minutes: number; endsAt: string; restarted: boolean }
  /** Decided meanwhile; a settled quest has no time limit any more. */
  | { status: "ALREADY_DECIDED"; questStatus: QuestStatus }
  /** 제한시간 연장 사용 is off in the 퀘스트 위젯 settings. */
  | { status: "DISABLED" }
  | { status: "INVALID"; message: string }
  | { status: "NOT_FOUND" | "UNAUTHORIZED" };

/**
 * What the supporter's 후원 내역 shows for one of their quests. `endsAt`: the deadline (sent time + time limit, later if the
 * creator extended it); `extendedMin`: the minutes the creator added (0 = never).
 */
export type QuestView = { status: QuestStatus; canDecide: boolean; endsAt: string; extendedMin: number };

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
  /**
   * Sent time + time limit, or the deadline of the last 시간 연장; past it the quest still runs until someone decides
   * (2026-10-04 결정).
   */
  endsAt: string;
  /** Minutes the creator added with 시간 연장 (0 = never extended). */
  extendedMin: number;
  actions: QuestAction[];
};

/**
 * The studio's running quests, oldest first (the order of the 퀘스트 위젯), and the server's clock for 남은 시간.
 * `allowExtension`: the 퀘스트 위젯's 제한시간 연장 사용 — the card offers 시간 연장 only while it is on.
 */
export type QuestRemoteView = { quests: QuestRemoteRow[]; serverNow: string; allowExtension: boolean };
