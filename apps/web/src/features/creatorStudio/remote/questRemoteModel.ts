import { QUEST_DECIDE_CONFIRM, QUEST_DECIDE_ERROR, QUEST_DECIDE_FAIL_TEXT } from "@/features/donations/questDecideText";
import { formatNumber } from "@/lib/format";
import type { QuestAction, QuestDecideResult, QuestRemoteRow } from "@/services/donations/questTypes";

/**
 * 리모컨 퀘스트 card logic (code-first) — no React here, so the tests drive it directly. A decision goes through the same
 * server action, confirmation and texts as 후원관리+ › 받은 후원 › 퀘스트 (QuestDecide).
 */

export const QUEST_OVERTIME_TEXT = "시간 초과 · 결과 대기";

const two = (n: number) => String(n).padStart(2, "0");

/** "남은 시간 04:59" (1:02:03 from an hour up), or 시간 초과 · 결과 대기 once the time limit passed — it still runs. */
export function questTimeLeft(endsAt: string, now: number): { text: string; over: boolean } {
  const sec = Math.floor((Date.parse(endsAt) - now) / 1000);
  if (sec <= 0) return { text: QUEST_OVERTIME_TEXT, over: true };
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return { text: `남은 시간 ${h > 0 ? `${h}:${two(m)}` : two(m)}:${two(sec % 60)}`, over: false };
}

/** Which quest the confirmation is about (the card lists several), then the 받은 후원 question word for word. */
export const questConfirmText = (row: QuestRemoteRow, outcome: QuestAction) =>
  `‘${row.title}’ · ${row.donor} · ${formatNumber(row.amount)} FN\n\n${QUEST_DECIDE_CONFIRM[outcome]}`;

/** What the card says once the server decided; the refund is the server's figure. */
export function questDecidedText(row: QuestRemoteRow, outcome: QuestAction, refundedFn: number) {
  const name = `‘${row.title}’ 퀘스트`;
  if (outcome === "SUCCESS") return `${name}를 성공으로 정했어요.`;
  const refund = `${formatNumber(refundedFn)} FN을 후원자에게 전액 환불했어요.`;
  return outcome === "FAILED" ? `${name}를 실패로 정했어요. ${refund}` : `${name}를 취소했어요. ${refund}`;
}

export type QuestRemoteNotice = { tone: "ok" | "error"; text: string };

export type QuestDecision =
  /** Not sent: not confirmed, an action this quest does not offer, or a request for it is already on its way (a double click). */
  | { kind: "SKIPPED" }
  | { kind: "DECIDED"; notice: QuestRemoteNotice }
  /** Signed out meanwhile. */
  | { kind: "SIGN_IN" }
  /** `refresh`: the quest was settled elsewhere or is gone, so the list should drop it. */
  | { kind: "FAILED"; notice: QuestRemoteNotice; refresh: boolean };

export type QuestDecideDeps = {
  /** Quest ids with a request on its way; shared by every click on the card. */
  inFlight: Set<string>;
  confirm: (message: string) => boolean;
  /** `decideReceivedQuest` — the server action 받은 후원 uses. */
  decide: (input: { id: string; outcome: QuestAction }) => Promise<QuestDecideResult>;
  /** Called once the request is about to go (after the confirmation). */
  onStart?: () => void;
};

/**
 * One decision from the card. A second click on the same quest while its request is on its way is skipped before any
 * dialog opens; the server also answers a repeated decision with the first result (retry-safe) and refuses the other
 * outcome, so a quest is settled — and refunded — once.
 */
export async function decideFromRemote(row: QuestRemoteRow, outcome: QuestAction, deps: QuestDecideDeps): Promise<QuestDecision> {
  if (!row.actions.includes(outcome) || deps.inFlight.has(row.id)) return { kind: "SKIPPED" };
  deps.inFlight.add(row.id);
  try {
    if (!deps.confirm(questConfirmText(row, outcome))) return { kind: "SKIPPED" };
    deps.onStart?.();
    const res = await deps.decide({ id: row.id, outcome });
    if (res.status === "OK") return { kind: "DECIDED", notice: { tone: "ok", text: questDecidedText(row, outcome, res.refundedFn) } };
    if (res.status === "UNAUTHORIZED") return { kind: "SIGN_IN" };
    return { kind: "FAILED", notice: { tone: "error", text: QUEST_DECIDE_FAIL_TEXT[res.status] }, refresh: res.status === "ALREADY_DECIDED" || res.status === "NOT_FOUND" };
  } catch {
    return { kind: "FAILED", notice: { tone: "error", text: QUEST_DECIDE_ERROR }, refresh: false };
  } finally {
    deps.inFlight.delete(row.id);
  }
}
