"use server";

import { USE_MOCK } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { STUDIO_CHANNEL } from "@/services/crew/mockCrewStore";
import { creatorQuestActions, mockQuests } from "@/services/donations/questCore";
import type { QuestRemoteView } from "@/services/donations/questTypes";

/**
 * 리모컨 퀘스트 (code-first, funnation 기본값): the studio's running quests, so the creator can settle a mission without
 * leaving the 리모컨. Read only — the card decides with the same server action as 후원관리+ › 받은 후원 › 퀘스트
 * (`decideReceivedQuest`), so both places change the same record with the same checks and retry rule.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Quest remote API is not connected yet.");
};

export async function getQuestRemote(): Promise<QuestRemoteView | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  const quests = mockQuests.items
    .filter((q) => q.channelId === STUDIO_CHANNEL && q.status === "IN_PROGRESS")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((q) => ({
      id: q.id,
      donor: q.donor,
      donorId: q.donorId,
      title: q.title,
      amount: q.amount,
      createdAt: q.createdAt,
      endsAt: new Date(Date.parse(q.createdAt) + q.timeLimitSec * 1000).toISOString(),
      actions: creatorQuestActions(q)
    }));
  return { quests, serverNow: new Date().toISOString() };
}
