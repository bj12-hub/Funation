"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getSession } from "@/lib/session";
import { decideQuest, findQuest } from "./questCore";
import { isQuestOutcome, type QuestDecideResult } from "./questTypes";

/**
 * The supporter settles a quest they sent (the 결정 권한 table: the supporter can always decide).
 * FAILED refunds the whole amount to their wallet. Deciding again with the same outcome is a no-op.
 */
export async function decideMyQuest(input: unknown): Promise<QuestDecideResult> {
  if (!USE_MOCK) throw new Error("Quest API is not connected yet.");
  const session = await getSession();
  if (!session) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  if (!isQuestOutcome(v.outcome)) return { status: "INVALID" };
  const quest = findQuest(v.id);
  // Someone else's quest looks missing.
  if (!quest || quest.supporterUserId !== session.userId) return { status: "NOT_FOUND" };
  await mockDelay(300);
  return decideQuest(quest, v.outcome, "DONOR");
}
