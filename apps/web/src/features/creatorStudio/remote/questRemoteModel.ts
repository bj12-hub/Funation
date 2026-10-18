import { QUEST_DECIDE_CONFIRM, QUEST_DECIDE_ERROR, QUEST_DECIDE_FAIL_TEXT } from "@/features/donations/questDecideText";
import { formatNumber, kstIsoString } from "@/lib/format";
import {
  QUEST_EXTEND_BOUNDS_TEXT,
  QUEST_EXTEND_MINUTES,
  type QuestAction,
  type QuestDecideResult,
  type QuestExtendResult,
  type QuestRemoteRow
} from "@/services/donations/questTypes";

/**
 * 리모컨 퀘스트 card logic (code-first) — no React here, so the tests drive it directly. A decision goes through the same
 * server action, confirmation and texts as 후원관리+ › 받은 후원 › 퀘스트 (QuestDecide). 시간 연장 (2026-10-18 결정) is the
 * card's own: `extendQuestTime`, offered while the 퀘스트 위젯's 제한시간 연장 사용 is on.
 */

export const QUEST_OVERTIME_TEXT = "시간 초과 · 결과 대기";

const two = (n: number) => String(n).padStart(2, "0");

/** "2026.10.08 15:04" in Korea time, as 받은 후원 shows it (a quest past its time limit can be days old). */
export const formatQuestAt = (iso: string) => kstIsoString(iso).slice(0, 16).replaceAll("-", ".").replace("T", " ");

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

// ── 시간 연장 (2026-10-18 결정) ──────────────────────────────────────────────────

/** The row's button, and the minutes field the form starts with. */
export const QUEST_EXTEND_BUTTON = "시간 연장";
export const QUEST_EXTEND_DEFAULT_MINUTES = "5";

/** What the server answers when the extension did not happen (INVALID carries its own message). */
export const QUEST_EXTEND_FAIL_TEXT: Record<"ALREADY_DECIDED" | "DISABLED" | "NOT_FOUND", string> = {
  ALREADY_DECIDED: "이미 결과가 정해진 퀘스트라 연장할 수 없어요.",
  DISABLED: "퀘스트 위젯 설정에서 제한시간 연장 사용이 꺼져 있어요.",
  NOT_FOUND: "퀘스트를 찾을 수 없어요."
};

/** Whole minutes in 1~60 (the server checks the same), or null. */
export function parseExtendMinutes(text: string): number | null {
  const t = text.trim();
  if (!/^\d{1,3}$/.test(t)) return null;
  const n = Number(t);
  return n >= QUEST_EXTEND_MINUTES.min && n <= QUEST_EXTEND_MINUTES.max ? n : null;
}

/** Under the minutes field: where the minutes go — onto the deadline, or from now once it passed. */
export const questExtendHint = (row: QuestRemoteRow, now: number) =>
  questTimeLeft(row.endsAt, now).over
    ? `제한 시간이 지난 퀘스트라 지금부터 다시 계산해요 (${QUEST_EXTEND_MINUTES.min}~${QUEST_EXTEND_MINUTES.max}분).`
    : `지금 마감 ${formatQuestAt(row.endsAt)}에 더해져요 (${QUEST_EXTEND_MINUTES.min}~${QUEST_EXTEND_MINUTES.max}분).`;

/** Which quest, then the new deadline — or, past the deadline, that the clock starts again from now. */
export function questExtendConfirmText(row: QuestRemoteRow, minutes: number, now: number) {
  const head = `‘${row.title}’ · ${row.donor} · ${formatNumber(row.amount)} FN\n\n`;
  if (questTimeLeft(row.endsAt, now).over) return `${head}제한 시간이 지난 퀘스트예요. 지금부터 ${minutes}분 뒤를 새 마감으로 정할까요?\n연장한 시간은 되돌릴 수 없어요.`;
  const to = new Date(Date.parse(row.endsAt) + minutes * 60_000).toISOString();
  return `${head}제한 시간을 ${minutes}분 연장할까요?\n마감 ${formatQuestAt(row.endsAt)} → ${formatQuestAt(to)}\n연장한 시간은 되돌릴 수 없어요.`;
}

/** What the card says once the server extended it; the deadline is the server's. */
export function questExtendedText(row: QuestRemoteRow, res: Extract<QuestExtendResult, { status: "OK" }>) {
  const at = formatQuestAt(res.endsAt);
  return res.restarted
    ? `‘${row.title}’ 퀘스트는 제한 시간이 지나 지금부터 ${res.minutes}분 뒤로 마감을 정했어요 · 새 마감 ${at}`
    : `‘${row.title}’ 퀘스트의 제한 시간을 ${res.minutes}분 연장했어요 · 새 마감 ${at}`;
}

export type QuestExtendOutcome =
  /** Not sent: not confirmed, or a request for this quest is already on its way. */
  | { kind: "SKIPPED" }
  | { kind: "EXTENDED"; notice: QuestRemoteNotice }
  | { kind: "SIGN_IN" }
  /** `refresh`: the quest was settled, is gone, or 연장 is off now — the list should catch up. */
  | { kind: "FAILED"; notice: QuestRemoteNotice; refresh: boolean };

export type QuestExtendDeps = {
  /** The same set as decisions: one request per quest at a time, whichever button sent it. */
  inFlight: Set<string>;
  /**
   * The request id of an extension that got no answer, per quest. Sending the same minutes again reuses it, so an
   * extension that did land before its answer was lost is not added twice; other minutes are a new extension.
   */
  pending: Map<string, { minutes: number; requestId: string }>;
  newRequestId: () => string;
  confirm: (message: string) => boolean;
  /** `extendQuestTime`. */
  extend: (input: { id: string; minutes: number; requestId: string }) => Promise<QuestExtendResult>;
  onStart?: () => void;
};

/** One 시간 연장 from the card: the minutes as typed, checked, confirmed, then sent with a request id. */
export async function extendFromRemote(row: QuestRemoteRow, minutesText: string, now: number, deps: QuestExtendDeps): Promise<QuestExtendOutcome> {
  const minutes = parseExtendMinutes(minutesText);
  if (minutes === null) return { kind: "FAILED", notice: { tone: "error", text: QUEST_EXTEND_BOUNDS_TEXT }, refresh: false };
  if (deps.inFlight.has(row.id)) return { kind: "SKIPPED" };
  deps.inFlight.add(row.id);
  try {
    if (!deps.confirm(questExtendConfirmText(row, minutes, now))) return { kind: "SKIPPED" };
    const kept = deps.pending.get(row.id);
    const requestId = kept && kept.minutes === minutes ? kept.requestId : deps.newRequestId();
    deps.pending.set(row.id, { minutes, requestId });
    deps.onStart?.();
    const res = await deps.extend({ id: row.id, minutes, requestId });
    deps.pending.delete(row.id); // answered: the next one is a new extension
    if (res.status === "OK") return { kind: "EXTENDED", notice: { tone: "ok", text: questExtendedText(row, res) } };
    if (res.status === "UNAUTHORIZED") return { kind: "SIGN_IN" };
    if (res.status === "INVALID") return { kind: "FAILED", notice: { tone: "error", text: res.message }, refresh: false };
    return { kind: "FAILED", notice: { tone: "error", text: QUEST_EXTEND_FAIL_TEXT[res.status] }, refresh: true };
  } catch {
    return { kind: "FAILED", notice: { tone: "error", text: QUEST_DECIDE_ERROR }, refresh: false };
  } finally {
    deps.inFlight.delete(row.id);
  }
}
