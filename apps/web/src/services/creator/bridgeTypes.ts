import type { Platform } from "@/types/platform";

/**
 * 외부 프로그램 연동 — code-first, StreamDonate "외부 프로그램 API (조명 · Resolume · Companion)" 참고 (P3). Client-safe.
 * Programs like these listen on the streaming PC (or its local network), which a server on the internet cannot reach. So the
 * requests are sent by the 연동 페이지 — a page the creator keeps open on that PC (an OBS browser source or a browser tab):
 * when a donation alert starts showing, every 규칙 it matches sends one HTTP request from there. The server only stores the
 * rules, picks the matches and makes sure each alert × rule fires once (several open 연동 페이지 never double up); it never
 * requests the creator's addresses itself.
 */

export const BRIDGE_RULES_MAX = 20;
export const BRIDGE_NAME_MAX = 20;
export const BRIDGE_URL_MAX = 500;
export const BRIDGE_BODY_MAX = 2000;
export const BRIDGE_DELAY_MAX = 30;
export const BRIDGE_LOG_MAX = 50;

export type BridgeMethod = "GET" | "POST";
export const BRIDGE_METHODS: BridgeMethod[] = ["GET", "POST"];

/**
 * A 규칙: when an alert starts showing that is a 시그니처 `signatureId` (null = any) of at least `minFn` FN (0 = any amount,
 * platform 후원 too) — 테스트 후원 only with `includeTest` — send `method url` (with `body` for POST) `delaySec` later.
 */
export type BridgeRule = {
  id: string;
  name: string;
  enabled: boolean;
  minFn: number;
  signatureId: string | null;
  includeTest: boolean;
  delaySec: number;
  method: BridgeMethod;
  url: string;
  body: string;
};

/** The alert a rule reacts to (what the alert overlay shows, plus its 시그니처). */
export type BridgeEvent = {
  id: string;
  /** DONATION · EXTERNAL (플랫폼 후원) · TEST (테스트 후원). */
  kind: string;
  nickname: string;
  message: string;
  /** FN (0 for EXTERNAL). */
  amount: number;
  amountLabel: string;
  typeLabel: string;
  platform: Platform | null;
  signatureId: string | null;
};

export type BridgeRequest = { method: BridgeMethod; url: string; body: string };
/** FIRED: claimed by a 연동 페이지 and being sent; SENT / FAILED: what that page reported. */
export type BridgeOutcome = "FIRED" | "SENT" | "FAILED";
export const BRIDGE_OUTCOME_LABEL: Record<BridgeOutcome, string> = { FIRED: "보내는 중", SENT: "보냄", FAILED: "연결 실패" };
export type BridgeLogEntry = { id: string; at: string; ruleName: string; nickname: string; amountLabel: string; url: string; outcome: BridgeOutcome };

/** The studio. `bridgePath` holds the overlay key (shown masked). */
export type BridgeView = { rules: BridgeRule[]; log: BridgeLogEntry[]; signatures: { id: string; name: string; price: number }[]; bridgePath: string };
export type BridgeResult = { status: "SAVED" } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };
/** The 연동 페이지: the alert showing now and the rules it matches; `reloadSeq` · `on` from 리모컨. */
export type BridgeData = { event: BridgeEvent | null; fire: string[]; rules: number; reloadSeq: number; on: boolean };
/** FIRE: this page sends it (`delaySec` later) and reports back with `claimId`; TAKEN: another page already did. */
export type BridgeClaim = { status: "FIRE"; claimId: string; request: BridgeRequest; delaySec: number } | { status: "TAKEN" } | { status: "INVALID" };

export const BRIDGE_VARIABLES = [
  { key: "{nickname}", label: "후원자 닉네임" },
  { key: "{amount}", label: "FN 금액 (숫자)" },
  { key: "{amountLabel}", label: "금액 표시 (1,000 FN · ₩5,000)" },
  { key: "{message}", label: "후원 메시지" },
  { key: "{type}", label: "후원 종류 (텍스트 후원 …)" },
  { key: "{platform}", label: "플랫폼 (YOUTUBE … · 썸네이션 후원은 빈칸)" }
] as const;

/** 예시 규칙 (the addresses are the programs' usual defaults — change them to match the program's settings). */
export const BRIDGE_TEMPLATES: { key: string; label: string; method: BridgeMethod; url: string; body: string }[] = [
  { key: "companion", label: "Companion 버튼 누르기", method: "POST", url: "http://127.0.0.1:8000/api/location/1/0/0/press", body: "" },
  { key: "resolume", label: "Resolume 클립 실행", method: "POST", url: "http://127.0.0.1:8080/api/v1/composition/layers/1/clips/1/connect", body: "" },
  { key: "get", label: "주소 열기 (GET, 조명 컨트롤러 등)", method: "GET", url: "http://192.168.0.10/scene?name=donation&who={nickname}", body: "" }
];

/** Whether `rule` fires for `event`. */
export function ruleMatches(rule: BridgeRule, event: BridgeEvent): boolean {
  if (!rule.enabled) return false;
  if (event.kind === "TEST" && !rule.includeTest) return false;
  if (rule.signatureId && event.signatureId !== rule.signatureId) return false;
  return event.kind === "EXTERNAL" ? rule.minFn === 0 : event.amount >= rule.minFn;
}

const values = (e: BridgeEvent): Record<string, string> => ({
  "{nickname}": e.nickname,
  "{amount}": String(e.amount),
  "{amountLabel}": e.amountLabel,
  "{message}": e.message,
  "{type}": e.typeLabel,
  "{platform}": e.platform ?? ""
});
/** `text` with the variables filled in one pass (a value is never read as a variable); URL parts are encoded. */
const fill = (text: string, e: BridgeEvent, encode: boolean) => {
  const v = values(e);
  return text.replace(/\{(nickname|amount|amountLabel|message|type|platform)\}/g, (k) => (encode ? encodeURIComponent(v[k]) : v[k]));
};

/** The request `rule` sends for `event`. */
export const renderRequest = (rule: Pick<BridgeRule, "method" | "url" | "body">, event: BridgeEvent): BridgeRequest => ({
  method: rule.method,
  url: fill(rule.url, event, true),
  body: rule.method === "POST" ? fill(rule.body, event, false) : ""
});

/** A sample alert for 테스트 보내기 in the studio. */
export const SAMPLE_EVENT: BridgeEvent = { id: "sample", kind: "TEST", nickname: "테스트", message: "외부 연동 테스트예요", amount: 10_000, amountLabel: "10,000 FN", typeLabel: "텍스트 후원", platform: null, signatureId: null };
