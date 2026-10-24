import { randomUUID } from "node:crypto";
import { advance, mockAlerts } from "./alertCore";
import {
  BRIDGE_BODY_MAX,
  BRIDGE_DELAY_MAX,
  BRIDGE_LOG_MAX,
  BRIDGE_METHODS,
  BRIDGE_NAME_MAX,
  BRIDGE_RULES_MAX,
  BRIDGE_URL_MAX,
  SAMPLE_EVENT,
  renderRequest,
  ruleMatches,
  type BridgeClaim,
  type BridgeEvent,
  type BridgeLogEntry,
  type BridgeRule
} from "./bridgeTypes";

/**
 * 외부 프로그램 연동 (server-only) — code-first. The rules, and the claims that make each alert × rule fire once however many
 * 연동 페이지 are open: the first page to claim it gets the request to send, the others hear TAKEN. Claims are only for the
 * alert showing now, so a page cannot fire old or made-up alerts. The server never sends the requests itself.
 */

type BridgeStore = { rules: BridgeRule[]; log: BridgeLogEntry[]; claims: Record<string, string>; claimOrder: string[] };
const CLAIMS_MAX = 500;
const g = globalThis as typeof globalThis & { __ssumnationMockBridgeV1?: BridgeStore };
export const bridgeStore = (): BridgeStore => (g.__ssumnationMockBridgeV1 ??= { rules: [], log: [], claims: {}, claimOrder: [] });

const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** Why `url` is not an address a rule can call (http/https, no user:password), or null. Checked with sample values in place. */
function badUrl(url: string): string | null {
  if (!url || url.length > BRIDGE_URL_MAX) return `주소는 1~${BRIDGE_URL_MAX}자로 입력해 주세요.`;
  let parsed: URL;
  try {
    parsed = new URL(renderRequest({ method: "GET", url, body: "" }, SAMPLE_EVENT).url);
  } catch {
    return "주소를 확인해 주세요. http:// 나 https:// 로 시작해야 해요.";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "주소를 확인해 주세요. http:// 나 https:// 로 시작해야 해요.";
  if (parsed.username || parsed.password) return "주소에 아이디 · 비밀번호는 넣을 수 없어요.";
  return null;
}

export function parseBridgeRules(input: unknown, forbidden: string[], signatureIds: string[]): BridgeRule[] | { message: string } {
  if (!Array.isArray(input)) return { message: "설정을 확인해 주세요." };
  if (input.length > BRIDGE_RULES_MAX) return { message: `규칙은 ${BRIDGE_RULES_MAX}개까지 만들 수 있어요.` };
  const rules: BridgeRule[] = [];
  for (const raw of input) {
    const v = rec(raw);
    if (typeof v.id !== "string" || !/^[A-Za-z0-9-]{4,40}$/.test(v.id) || rules.some((r) => r.id === v.id)) return { message: "설정을 확인해 주세요." };
    const name = typeof v.name === "string" ? v.name.trim() : "";
    if (!name || name.length > BRIDGE_NAME_MAX) return { message: `규칙 이름은 1~${BRIDGE_NAME_MAX}자로 입력해 주세요.` };
    if (forbidden.some((w) => name.toLowerCase().includes(w))) return { message: "사용할 수 없는 단어가 포함되어 있어요." };
    const method = BRIDGE_METHODS.find((m) => m === v.method);
    if (!method || typeof v.enabled !== "boolean" || typeof v.includeTest !== "boolean") return { message: "설정을 확인해 주세요." };
    if (!isInt(v.minFn, 0, 100_000_000)) return { message: `${name}: 최소 금액은 0 이상의 정수로 입력해 주세요.` };
    if (!isInt(v.delaySec, 0, BRIDGE_DELAY_MAX)) return { message: `${name}: 지연은 0 ~ ${BRIDGE_DELAY_MAX}초예요.` };
    const signatureId = v.signatureId === null || v.signatureId === "" ? null : typeof v.signatureId === "string" && signatureIds.includes(v.signatureId) ? v.signatureId : undefined;
    if (signatureId === undefined) return { message: `${name}: 없는 시그니처예요. 다시 골라 주세요.` };
    const url = typeof v.url === "string" ? v.url.trim() : "";
    const why = badUrl(url);
    if (why) return { message: `${name}: ${why}` };
    const body = typeof v.body === "string" ? v.body : "";
    if (body.length > BRIDGE_BODY_MAX) return { message: `${name}: 보낼 내용은 ${BRIDGE_BODY_MAX}자까지예요.` };
    rules.push({ id: v.id, name, enabled: v.enabled, minFn: v.minFn, signatureId, includeTest: v.includeTest, delaySec: v.delaySec, method, url, body: method === "POST" ? body : "" });
  }
  return rules;
}

/** The donation alert showing now, as the rules see it (null when none). */
export function showingEvent(now = Date.now()): BridgeEvent | null {
  advance(now);
  const a = mockAlerts.items.find((x) => x.status === "SHOWING");
  if (!a) return null;
  return {
    id: a.id,
    kind: a.kind,
    nickname: a.donor,
    message: a.message,
    amount: a.kind === "EXTERNAL" ? 0 : a.fnAmount,
    amountLabel: a.amountLabel ?? `${a.fnAmount.toLocaleString("ko-KR")} FN`,
    typeLabel: a.typeLabel,
    platform: a.platform ?? null,
    signatureId: a.signatureId ?? null
  };
}

/** The rules the showing alert fires. */
export function firing(event: BridgeEvent | null) {
  return event ? bridgeStore().rules.filter((r) => ruleMatches(r, event)).map((r) => r.id) : [];
}

/** A 연동 페이지 asks to send `ruleId` for `alertId`: FIRE for the first ask, TAKEN after; INVALID unless that alert shows now and the rule fires for it. */
export function claimBridge(alertId: unknown, ruleId: unknown, now = Date.now()): BridgeClaim {
  const event = showingEvent(now);
  const s = bridgeStore();
  const rule = s.rules.find((r) => r.id === ruleId);
  if (!event || event.id !== alertId || !rule || !ruleMatches(rule, event)) return { status: "INVALID" };
  const key = `${event.id}:${rule.id}`;
  if (s.claims[key]) return { status: "TAKEN" };
  const claimId = randomUUID();
  s.claims[key] = claimId;
  s.claimOrder.push(key);
  while (s.claimOrder.length > CLAIMS_MAX) delete s.claims[s.claimOrder.shift()!];
  const request = renderRequest(rule, event);
  s.log.unshift({ id: claimId, at: new Date(now).toISOString(), ruleName: rule.name, nickname: event.nickname, amountLabel: event.amountLabel, url: request.url, outcome: "FIRED" });
  s.log.splice(BRIDGE_LOG_MAX);
  return { status: "FIRE", claimId, request, delaySec: rule.delaySec };
}

/** What the page that sent it reports (once; a later report of the same claim changes nothing). */
export function reportBridge(claimId: unknown, outcome: unknown) {
  if (outcome !== "SENT" && outcome !== "FAILED") return;
  const entry = bridgeStore().log.find((e) => e.id === claimId);
  if (entry && entry.outcome === "FIRED") entry.outcome = outcome;
}
