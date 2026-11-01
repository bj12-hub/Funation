import { requestFrom, type DeviceContext } from "./auth";
import { FlextvUnavailableError, flextvRequest, isRecord, type FlextvResponse } from "./client";
import { readRefOptions } from "./studio";
import { kstStamp } from "./wallet";

/**
 * FLEXTV's 환전 (docs/development/flextv-backend.md "5단계"): the streamer's payout account, the 환전 hours, a 환전
 * request and the list of past ones. The `read*` and `map*` functions are pure and tested in `settlement.test.ts`.
 *
 * FLEXTV computes every ₩ figure itself (its contract rate, the 3.3% withholding); Ssumnation only shows them. The full
 * account number FLEXTV returns never leaves this module: callers get it masked.
 */

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : null);
const text = (value: unknown) => (typeof value === "string" ? value : "");

/* ── The payout account ──────────────────────────────────── */

export type FlextvBank = { bankCode: string; holder: string; accountMasked: string };

/** Every digit but the last four hidden: "*******8901". */
export const maskAccount = (account: string) => {
  const digits = account.replace(/\D/g, "");
  return digits.length <= 4 ? "*".repeat(digits.length) : `${"*".repeat(digits.length - 4)}${digits.slice(-4)}`;
};

/** `GET /api/my/banks`: null, or the registered account (one per member). */
export function readBank(data: unknown): FlextvBank | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!isRecord(row)) return null;
  const account = text(row.bankAccount);
  const bankCode = row.bankCode === null || row.bankCode === undefined ? "" : String(row.bankCode);
  if (!account.replace(/\D/g, "") || !bankCode) return null;
  return { bankCode, holder: text(row.bankHolderName), accountMasked: maskAccount(account) };
}

export async function fetchBank(token: string): Promise<FlextvBank | null> {
  const response = await flextvRequest("/api/my/banks", { token });
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV banks answered ${response.status}`);
  return readBank(response.data);
}

const BANKS_TTL_MS = 10 * 60 * 1000;
const g = globalThis as typeof globalThis & { __ssumnationFlextvBanks?: { at: number; names: Map<string, string> } };

/** FLEXTV's bank names by code (its `bankCode` reference list). */
export async function fetchBankNames(): Promise<Map<string, string>> {
  const cached = g.__ssumnationFlextvBanks;
  if (cached && Date.now() - cached.at < BANKS_TTL_MS) return cached.names;
  const response = await flextvRequest("/api/guest/refcode/bankCode");
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV bank codes answered ${response.status}`);
  const names = new Map(readRefOptions(response.data).map((o) => [o.value, o.label]));
  if (names.size > 0) g.__ssumnationFlextvBanks = { at: Date.now(), names };
  return names;
}

/* ── 환전 hours ──────────────────────────────────────────── */

/** `GET /api/guest/timeCheck/21`: "true" while FLEXTV takes 환전 requests (from 00:01 until 14:00, its time). */
export const readExchangeOpen = (data: unknown) => data === true || data === "true";

export async function fetchExchangeOpen(): Promise<boolean> {
  const response = await flextvRequest("/api/guest/timeCheck/21");
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV exchange hours answered ${response.status}`);
  return readExchangeOpen(response.data);
}

/* ── Past requests ───────────────────────────────────────── */

/** FLEXTV's 환전 states (its `SET_WITHDRAW_REQUEST_STATUS`). */
export const WITHDRAW_STATUS = { REQUESTED: 0, IN_REVIEW: 1, REVIEWED: 2, APPROVED: 4, CANCELED: 7, REJECTED: 8, PAID: 9 } as const;

export type FlextvWithdrawal = {
  id: string;
  /** KST "yyyy-mm-dd hh:mm:ss". */
  at: string;
  rex: number;
  /** 신청 금액: the 렉스 at the streamer's rate, in ₩. */
  grossKrw: number;
  /** 원천징수 (3.3%) as FLEXTV shows it. */
  taxKrw: number;
  /** 실수령액. */
  netKrw: number;
  status: number;
};

/** `GET /api/luv/withdraw-list`: one row per request, newest first. */
export function readWithdrawals(data: unknown): { items: FlextvWithdrawal[]; count: number } {
  const rows = isRecord(data) && Array.isArray(data.data) ? data.data : [];
  const items = rows.flatMap((row): FlextvWithdrawal[] => {
    if (!isRecord(row)) return [];
    const id = num(row.id);
    const at = kstStamp(row.createdAt);
    const rex = num(row.exAmount);
    if (id === null || !Number.isSafeInteger(id) || id <= 0 || !at || rex === null) return [];
    return [{ id: String(id), at, rex, grossKrw: num(row.exMoney) ?? 0, taxKrw: num(row.exVAT) ?? 0, netKrw: num(row.exRealMoney) ?? 0, status: num(row.status) ?? 0 }];
  });
  return { items, count: (isRecord(data) ? num(data.count) : null) ?? items.length };
}

export async function fetchWithdrawals(token: string, { offset, limit }: { offset: number; limit: number }) {
  const response = await flextvRequest(`/api/luv/withdraw-list?offset=${Math.max(0, Math.floor(offset))}&limit=${Math.min(50, Math.max(1, Math.floor(limit)))}`, { token });
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV withdraw list answered ${response.status}`);
  return readWithdrawals(response.data);
}

/* ── A request ───────────────────────────────────────────── */

export type WithdrawOutcome =
  | { kind: "REQUESTED" }
  | { kind: "UNAUTHORIZED" }
  /** FLEXTV said no: nothing was requested. */
  | { kind: "REFUSED"; reason: "BUSINESS_DAY" | "NOT_BUSINESS" | "NO_PHONE" | "OPEN_REQUEST" | "OTHER"; message: string | null }
  /** FLEXTV's catch-all answer: its 환전 system may or may not have taken the request. */
  | { kind: "UNKNOWN" };

const REFUSALS: [string, Exclude<WithdrawOutcome, { kind: "REQUESTED" | "UNAUTHORIZED" | "UNKNOWN" }>["reason"]][] = [
  ["매주 수요일만", "BUSINESS_DAY"],
  ["사업자 정산이 불가능", "NOT_BUSINESS"],
  ["연락처가 비었습니다", "NO_PHONE"],
  ["이미 요청중인 처리", "OPEN_REQUEST"]
];

/** `POST /api/luv/withdraw`: "OK", or HTTP 200 with `{ message }` for every failure. */
export function mapWithdraw({ status, data }: Pick<FlextvResponse, "status" | "data">): WithdrawOutcome {
  if (status === 401) return { kind: "UNAUTHORIZED" };
  if (status !== 200) throw new FlextvUnavailableError(`FLEXTV withdraw answered ${status}`);
  if (data === "OK") return { kind: "REQUESTED" };
  const message = isRecord(data) ? text(data.message).trim() : "";
  if (!message || message === "요청이 실패하였습니다.") return { kind: "UNKNOWN" };
  const known = REFUSALS.find(([needle]) => message.includes(needle));
  if (known) return { kind: "REFUSED", reason: known[1], message };
  // Anything else is FLEXTV's 환전 system turning the request down, in words meant for the member.
  return { kind: "REFUSED", reason: "OTHER", message: message.length <= 100 && /[가-힣]/.test(message) ? message : null };
}

/** `businessType` 1 = 사업자 정산 (FLEXTV compares it as a number). */
export async function requestWithdraw(token: string, context: DeviceContext, { amount, business }: { amount: number; business: boolean }): Promise<WithdrawOutcome> {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("A 환전 amount is a whole number of 렉스.");
  return mapWithdraw(await flextvRequest("/api/luv/withdraw", { method: "POST", token, ...requestFrom(context), body: { amount, businessType: business ? 1 : 0 } }));
}

/* ── Cancelling ──────────────────────────────────────────── */

export type CancelOutcome = { kind: "CANCELED" } | { kind: "ALREADY_HANDLED" } | { kind: "REFUSED" } | { kind: "UNAUTHORIZED" };

export function mapCancel({ status, data }: Pick<FlextvResponse, "status" | "data">): CancelOutcome {
  if (status === 401) return { kind: "UNAUTHORIZED" };
  if (status !== 200) throw new FlextvUnavailableError(`FLEXTV withdraw cancel answered ${status}`);
  if (isRecord(data) && data.success) return { kind: "CANCELED" };
  if (isRecord(data) && typeof data.error === "string" && data.error.includes("이미")) return { kind: "ALREADY_HANDLED" };
  return { kind: "REFUSED" };
}

/** Callers pass only an id they just read from this member's own list, in the state a member may cancel (신청). */
export async function cancelWithdraw(token: string, context: DeviceContext, ownWithdrawalId: string): Promise<CancelOutcome> {
  if (!/^\d{1,15}$/.test(ownWithdrawalId)) throw new Error("A withdrawal id is a FLEXTV number.");
  return mapCancel(await flextvRequest(`/api/luv/withdraw-cancel?withdrawId=${ownWithdrawalId}`, { token, ...requestFrom(context) }));
}
