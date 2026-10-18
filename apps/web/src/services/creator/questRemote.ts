"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { STUDIO_CHANNEL } from "@/services/crew/mockCrewStore";
import { creatorQuestActions, extendQuest, findQuest, findQuestExtension, mockQuests, questEndsAt, questExtendedMin } from "@/services/donations/questCore";
import { QUEST_EXTEND_BOUNDS_TEXT, QUEST_EXTEND_MINUTES, type QuestExtendResult, type QuestRemoteView } from "@/services/donations/questTypes";
import { readWidget } from "./widgetStore";

/**
 * 리모컨 퀘스트 (code-first, funnation 기본값): the studio's running quests, so the creator can settle a mission without
 * leaving the 리모컨. The card decides with the same server action as 후원관리+ › 받은 후원 › 퀘스트
 * (`decideReceivedQuest`), so both places change the same record with the same checks and retry rule. 시간 연장
 * (`extendQuestTime`, 2026-10-18 결정) is the card's own, offered while the 퀘스트 위젯's 제한시간 연장 사용 is on.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Quest remote API is not connected yet.");
};

const REQUEST_ID = /^[A-Za-z0-9-]{16,64}$/;
const invalidRequest = { status: "INVALID", message: "잘못된 요청입니다." } as const;

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
      endsAt: questEndsAt(q),
      extendedMin: questExtendedMin(q),
      actions: creatorQuestActions(q)
    }));
  return { quests, serverNow: new Date().toISOString(), allowExtension: readWidget("QUEST").allowExtension };
}

/**
 * 시간 연장: adds `minutes` (whole, 1~60) to a running quest of the studio — counted from now when it is already past its
 * deadline. Needs the creator's session (a suspended or withdrawn creator has none) and 제한시간 연장 사용 on. `requestId`
 * makes it retry-safe: the same id for the same quest and minutes answers with the first result and adds nothing; the same
 * id with another quest or other minutes is refused. Every check from the request id on runs in the step that writes.
 */
export async function extendQuestTime(input: unknown): Promise<QuestExtendResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  if (typeof v.requestId !== "string" || !REQUEST_ID.test(v.requestId)) return invalidRequest;
  const { minutes } = v;
  if (typeof minutes !== "number" || !Number.isInteger(minutes) || minutes < QUEST_EXTEND_MINUTES.min || minutes > QUEST_EXTEND_MINUTES.max) {
    return { status: "INVALID", message: QUEST_EXTEND_BOUNDS_TEXT };
  }
  await mockDelay(300);
  // No await from here to the write: two requests (a double click, a retry racing the first) cannot both pass.
  const done = findQuestExtension(v.requestId);
  if (done) {
    if (done.quest.id !== v.id || done.extension.minutes !== minutes) return invalidRequest;
    return { status: "OK", minutes, endsAt: done.extension.endsAt, restarted: done.extension.restarted };
  }
  const quest = findQuest(v.id);
  if (!quest || quest.channelId !== STUDIO_CHANNEL) return { status: "NOT_FOUND" };
  if (quest.status !== "IN_PROGRESS") return { status: "ALREADY_DECIDED", questStatus: quest.status };
  if (!readWidget("QUEST").allowExtension) return { status: "DISABLED" };
  return extendQuest(quest, minutes, v.requestId);
}
