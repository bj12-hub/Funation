import { formatNumber, kstIsoString } from "@/lib/format";
import { messagesFor, translate, type MessageKey } from "@/lib/i18n/translate";
import {
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
 *
 * Texts come from the `studioRemote` messages (2026-11-01): each takes the screen's `t`, Korean when none is given (the
 * tests and any caller outside the I18nProvider), so the Korean wording is unchanged.
 */

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;
const korean: Translate = (key, vars) => translate(messagesFor("ko"), key, vars);

const two = (n: number) => String(n).padStart(2, "0");

/** "2026.10.08 15:04" in Korea time, as 받은 후원 shows it (a quest past its time limit can be days old). */
export const formatQuestAt = (iso: string) => kstIsoString(iso).slice(0, 16).replaceAll("-", ".").replace("T", " ");

/** "남은 시간 04:59" (1:02:03 from an hour up), or 시간 초과 · 결과 대기 once the time limit passed — it still runs. */
export function questTimeLeft(endsAt: string, now: number, t: Translate = korean): { text: string; over: boolean } {
  const sec = Math.floor((Date.parse(endsAt) - now) / 1000);
  if (sec <= 0) return { text: t("studioRemote.questOvertime"), over: true };
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return { text: t("studioRemote.timeLeft", { time: `${h > 0 ? `${h}:${two(m)}` : two(m)}:${two(sec % 60)}` }), over: false };
}

/** The 받은 후원 questions (`QUEST_DECIDE_CONFIRM`), the server's refusals (`QUEST_DECIDE_FAIL_TEXT`) and 시간 연장's, as message keys. */
const CONFIRM_KEY: Record<QuestAction, MessageKey> = {
  SUCCESS: "studioRemote.questConfirmSuccess",
  FAILED: "studioRemote.questConfirmFailed",
  CANCELED: "studioRemote.questConfirmCanceled"
};
const DECIDE_FAIL_KEY: Record<Exclude<QuestDecideResult["status"], "OK">, MessageKey> = {
  ALREADY_DECIDED: "studioRemote.questFailAlreadyDecided",
  FORBIDDEN: "studioRemote.questFailForbidden",
  NOT_FOUND: "studioRemote.questFailNotFound",
  INVALID: "studioRemote.questFailInvalid",
  UNAUTHORIZED: "studioRemote.signInAgain"
};

/** Which quest the confirmation is about (the card lists several), then the 받은 후원 question word for word. */
export const questConfirmText = (row: QuestRemoteRow, outcome: QuestAction, t: Translate = korean) =>
  `‘${row.title}’ · ${row.donor} · ${formatNumber(row.amount)} FN\n\n${t(CONFIRM_KEY[outcome])}`;

/** What the card says once the server decided; the refund is the server's figure. */
export function questDecidedText(row: QuestRemoteRow, outcome: QuestAction, refundedFn: number, t: Translate = korean) {
  if (outcome === "SUCCESS") return t("studioRemote.questDecidedSuccess", { title: row.title });
  const vars = { title: row.title, amount: formatNumber(refundedFn) };
  return outcome === "FAILED" ? t("studioRemote.questDecidedFailed", vars) : t("studioRemote.questDecidedCanceled", vars);
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
  /** The screen's language (Korean when left out). */
  t?: Translate;
};

/**
 * One decision from the card. A second click on the same quest while its request is on its way is skipped before any
 * dialog opens; the server also answers a repeated decision with the first result (retry-safe) and refuses the other
 * outcome, so a quest is settled — and refunded — once.
 */
export async function decideFromRemote(row: QuestRemoteRow, outcome: QuestAction, deps: QuestDecideDeps): Promise<QuestDecision> {
  const t = deps.t ?? korean;
  if (!row.actions.includes(outcome) || deps.inFlight.has(row.id)) return { kind: "SKIPPED" };
  deps.inFlight.add(row.id);
  try {
    if (!deps.confirm(questConfirmText(row, outcome, t))) return { kind: "SKIPPED" };
    deps.onStart?.();
    const res = await deps.decide({ id: row.id, outcome });
    if (res.status === "OK") return { kind: "DECIDED", notice: { tone: "ok", text: questDecidedText(row, outcome, res.refundedFn, t) } };
    if (res.status === "UNAUTHORIZED") return { kind: "SIGN_IN" };
    return { kind: "FAILED", notice: { tone: "error", text: t(DECIDE_FAIL_KEY[res.status]) }, refresh: res.status === "ALREADY_DECIDED" || res.status === "NOT_FOUND" };
  } catch {
    return { kind: "FAILED", notice: { tone: "error", text: t("studioRemote.questError") }, refresh: false };
  } finally {
    deps.inFlight.delete(row.id);
  }
}

// ── 시간 연장 (2026-10-18 결정) ──────────────────────────────────────────────────

/** The minutes field the form starts with (the row's button is `studioRemote.questExtend`). */
export const QUEST_EXTEND_DEFAULT_MINUTES = "5";

/** What the server answers when the extension did not happen (INVALID carries its own message). */
const EXTEND_FAIL_KEY: Record<"ALREADY_DECIDED" | "DISABLED" | "NOT_FOUND", MessageKey> = {
  ALREADY_DECIDED: "studioRemote.extendFailAlreadyDecided",
  DISABLED: "studioRemote.extendFailDisabled",
  NOT_FOUND: "studioRemote.questFailNotFound"
};

/** Whole minutes in 1~60 (the server checks the same), or null. */
export function parseExtendMinutes(text: string): number | null {
  const t = text.trim();
  if (!/^\d{1,3}$/.test(t)) return null;
  const n = Number(t);
  return n >= QUEST_EXTEND_MINUTES.min && n <= QUEST_EXTEND_MINUTES.max ? n : null;
}

/** Under the minutes field: where the minutes go — onto the deadline, or from now once it passed. */
export const questExtendHint = (row: QuestRemoteRow, now: number, t: Translate = korean) =>
  questTimeLeft(row.endsAt, now).over
    ? t("studioRemote.extendHintOver", { min: QUEST_EXTEND_MINUTES.min, max: QUEST_EXTEND_MINUTES.max })
    : t("studioRemote.extendHint", { at: formatQuestAt(row.endsAt), min: QUEST_EXTEND_MINUTES.min, max: QUEST_EXTEND_MINUTES.max });

/** Which quest, then the new deadline — or, past the deadline, that the clock starts again from now. */
export function questExtendConfirmText(row: QuestRemoteRow, minutes: number, now: number, t: Translate = korean) {
  const head = `‘${row.title}’ · ${row.donor} · ${formatNumber(row.amount)} FN\n\n`;
  if (questTimeLeft(row.endsAt, now).over) return `${head}${t("studioRemote.extendConfirmOver", { minutes })}`;
  const to = new Date(Date.parse(row.endsAt) + minutes * 60_000).toISOString();
  return `${head}${t("studioRemote.extendConfirm", { minutes, from: formatQuestAt(row.endsAt), to: formatQuestAt(to) })}`;
}

/** What the card says once the server extended it; the deadline is the server's. */
export function questExtendedText(row: QuestRemoteRow, res: Extract<QuestExtendResult, { status: "OK" }>, t: Translate = korean) {
  const vars = { title: row.title, minutes: res.minutes, at: formatQuestAt(res.endsAt) };
  return res.restarted ? t("studioRemote.extendedRestarted", vars) : t("studioRemote.extendedOk", vars);
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
  /** The screen's language (Korean when left out). */
  t?: Translate;
};

/** One 시간 연장 from the card: the minutes as typed, checked, confirmed, then sent with a request id. */
export async function extendFromRemote(row: QuestRemoteRow, minutesText: string, now: number, deps: QuestExtendDeps): Promise<QuestExtendOutcome> {
  const t = deps.t ?? korean;
  const minutes = parseExtendMinutes(minutesText);
  if (minutes === null) return { kind: "FAILED", notice: { tone: "error", text: t("studioRemote.extendBounds", { min: QUEST_EXTEND_MINUTES.min, max: QUEST_EXTEND_MINUTES.max }) }, refresh: false };
  if (deps.inFlight.has(row.id)) return { kind: "SKIPPED" };
  deps.inFlight.add(row.id);
  try {
    if (!deps.confirm(questExtendConfirmText(row, minutes, now, t))) return { kind: "SKIPPED" };
    const kept = deps.pending.get(row.id);
    const requestId = kept && kept.minutes === minutes ? kept.requestId : deps.newRequestId();
    deps.pending.set(row.id, { minutes, requestId });
    deps.onStart?.();
    const res = await deps.extend({ id: row.id, minutes, requestId });
    deps.pending.delete(row.id); // answered: the next one is a new extension
    if (res.status === "OK") return { kind: "EXTENDED", notice: { tone: "ok", text: questExtendedText(row, res, t) } };
    if (res.status === "UNAUTHORIZED") return { kind: "SIGN_IN" };
    if (res.status === "INVALID") return { kind: "FAILED", notice: { tone: "error", text: res.message }, refresh: false };
    return { kind: "FAILED", notice: { tone: "error", text: t(EXTEND_FAIL_KEY[res.status]) }, refresh: true };
  } catch {
    return { kind: "FAILED", notice: { tone: "error", text: t("studioRemote.questError") }, refresh: false };
  } finally {
    deps.inFlight.delete(row.id);
  }
}
