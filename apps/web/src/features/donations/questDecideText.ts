import type { QuestAction, QuestDecideResult } from "@/services/donations/questTypes";

/**
 * 퀘스트 결과 문구 (code-first), shared by every place a quest is decided — 후원관리+ › 받은 후원 › 퀘스트, the supporter's
 * 후원 내역 (QuestDecide) and the 리모컨 퀘스트 card — so each asks and answers the same way.
 */

/** Asked before a decision is sent; a result can never change. */
export const QUEST_DECIDE_CONFIRM: Record<QuestAction, string> = {
  SUCCESS: "퀘스트를 성공으로 정할까요? 정한 결과는 바꿀 수 없어요.",
  FAILED: "퀘스트를 실패로 정할까요? 후원한 FN은 후원자에게 전액 환불되고, 정한 결과는 바꿀 수 없어요.",
  CANCELED: "퀘스트를 취소할까요? 후원한 FN은 후원자에게 전액 환불되고, 되돌릴 수 없어요."
};

export const QUEST_ACTION_LABEL: Record<QuestAction, string> = { SUCCESS: "성공", FAILED: "실패 · 환불", CANCELED: "취소 · 환불" };

export const QUEST_DECIDE_FAIL_TEXT: Record<Exclude<QuestDecideResult["status"], "OK">, string> = {
  ALREADY_DECIDED: "이미 다른 결과로 정해진 퀘스트예요.",
  FORBIDDEN: "이 퀘스트는 후원자만 결과를 정할 수 있어요.",
  NOT_FOUND: "퀘스트를 찾을 수 없어요.",
  INVALID: "요청을 확인해 주세요.",
  UNAUTHORIZED: "다시 로그인해 주세요."
};

/** The request itself failed (network, server error). */
export const QUEST_DECIDE_ERROR = "처리하지 못했어요. 잠시 후 다시 시도해 주세요.";
