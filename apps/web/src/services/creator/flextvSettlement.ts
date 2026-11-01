"use server";

import { FlextvUnavailableError, isRecord } from "@/lib/flextv/client";
import { fetchReceivedSummary } from "@/lib/flextv/earnings";
import { createQueue } from "@/lib/flextv/queue";
import { requestDeviceContext } from "@/lib/flextv/request";
import { cancelWithdraw, fetchBank, fetchBankNames, fetchExchangeOpen, fetchWithdrawals, requestWithdraw, type FlextvWithdrawal } from "@/lib/flextv/settlement";
import { fetchMemberProfile } from "@/lib/flextv/studio";
import { readPaymentProfile } from "@/lib/flextv/wallet";
import { studioContext, type StudioContext } from "./flextvStudio";
import {
  EXCHANGE_MIN_REX,
  type CancelExchangeResult,
  type ExchangeHistoryView,
  type ExchangeRequestResult,
  type ExchangeRow,
  type FlextvSettlementView
} from "./flextvSettlementTypes";

/**
 * 정산 with FLEXTV (phase 5, docs/development/flextv-backend.md "5단계"): FLEXTV's 환전 of the 렉스 a streamer
 * received. FLEXTV pays at the streamer's contract rate and withholds tax itself; its own figures are shown.
 *
 * FLEXTV's 환전 request has no idempotency of its own and may answer "failed" for a request its 환전 system took, so
 * this keeps Ssumnation's promise of one request per confirmed 정산 신청:
 * - one key ⇒ one request, per member, for 30 minutes on this server;
 * - one request at a time per member, after FLEXTV's own rules are checked here too (본인인증, 계좌, hours, one open
 *   request, the minimum and the 환전 가능 렉스, 사업자 정산 on Wednesdays before 14:00);
 * - an unclear answer is settled by FLEXTV's list: a request newer than the last one before, for this amount. Until it
 *   shows (or two minutes passed) the result is IN_PROGRESS and the same key asks again.
 */

const serialize = createQueue("exchange");
const KEY_TTL_MS = 30 * 60 * 1000;
/** How long an unclear request may still appear in FLEXTV's list. */
const SETTLE_WINDOW_MS = 2 * 60 * 1000;
const HISTORY_PAGE_SIZE = 10;

type Entry = { at: number; fingerprint: string; result: Promise<ExchangeRequestResult>; reconcile: (() => Promise<ExchangeRequestResult>) | null };
const g = globalThis as typeof globalThis & { __ssumnationFlextvExchangeKeys?: Map<string, Entry> };
const keys = (g.__ssumnationFlextvExchangeKeys ??= new Map());

/** FLEXTV's 환전 rules run on its own clock (KST). */
const kstClock = (now = Date.now()) => {
  const d = new Date(now + 9 * 3_600_000);
  return { weekday: d.getUTCDay(), hour: d.getUTCHours() };
};

const rowOf = (w: FlextvWithdrawal): ExchangeRow => ({ ...w, cancelable: w.status === 0 });
const isOpen = (w: FlextvWithdrawal) => w.status <= 1;
const memberDiv = (profile: unknown) => (isRecord(profile) && isRecord(profile.profile) ? profile.profile.memberDiv : null);

export async function getFlextvSettlementView(): Promise<FlextvSettlementView | null> {
  const ctx = await studioContext();
  if (!ctx) return null;
  const [profile, bank, names, summary, list, open] = await Promise.all([
    fetchMemberProfile(ctx.token),
    fetchBank(ctx.token),
    fetchBankNames().catch(() => new Map<string, string>()),
    fetchReceivedSummary(ctx.token),
    fetchWithdrawals(ctx.token, { offset: 0, limit: 5 }),
    fetchExchangeOpen().catch(() => false)
  ]);
  if (!profile) return null;
  return {
    identityVerified: readPaymentProfile(profile)?.verified ?? false,
    account: bank && { bankName: names.get(bank.bankCode) ?? `은행 코드 ${bank.bankCode}`, holder: bank.holder, accountMasked: bank.accountMasked },
    exchangeable: summary.exchangeable,
    exchanging: summary.exchanging,
    exchanged: summary.exchanged,
    minRex: EXCHANGE_MIN_REX,
    business: memberDiv(profile) === 3,
    open,
    openRequest: list.items.some(isOpen),
    recent: list.items.map(rowOf)
  };
}

type Parsed = { amount: number; business: boolean; key: string };

function parse(input: unknown): Parsed | null {
  if (!isRecord(input)) return null;
  if (typeof input.idempotencyKey !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(input.idempotencyKey)) return null;
  if (typeof input.amount !== "number" || !Number.isSafeInteger(input.amount) || input.amount <= 0) return null;
  return { amount: input.amount, business: input.business === true, key: input.idempotencyKey };
}

export async function requestExchange(input: unknown): Promise<ExchangeRequestResult> {
  const ctx = await studioContext();
  if (!ctx) return { status: "UNAUTHORIZED" };
  const parsed = parse(input);
  if (!parsed) return { status: "INVALID", message: "정산 신청 렉스를 숫자로 입력해 주세요." };

  const now = Date.now();
  for (const [k, e] of keys) if (now - e.at > KEY_TTL_MS) keys.delete(k);
  const keyOf = `${ctx.session.userId}:${parsed.key}`;
  const fingerprint = JSON.stringify({ amount: parsed.amount, business: parsed.business });
  const previous = keys.get(keyOf);
  if (previous) {
    if (previous.fingerprint !== fingerprint) return { status: "CONFLICT" };
    const result = await previous.result;
    if (result.status === "IN_PROGRESS" && previous.reconcile) {
      previous.result = serialize(ctx.session.userId, previous.reconcile);
      return previous.result;
    }
    return result;
  }
  const entry: Entry = { at: now, fingerprint, result: Promise.resolve({ status: "IN_PROGRESS" }), reconcile: null };
  keys.set(keyOf, entry);
  const context = await requestDeviceContext();
  entry.result = serialize(ctx.session.userId, () => send(ctx, context, parsed, entry));
  // Nothing reached FLEXTV's request (a read before it failed): the same key may try again.
  entry.result.catch(() => keys.delete(keyOf));
  return entry.result;
}

async function send(ctx: StudioContext, context: Awaited<ReturnType<typeof requestDeviceContext>>, p: Parsed, entry: Entry): Promise<ExchangeRequestResult> {
  const [profile, bank, summary, list, open] = await Promise.all([
    fetchMemberProfile(ctx.token),
    fetchBank(ctx.token),
    fetchReceivedSummary(ctx.token),
    fetchWithdrawals(ctx.token, { offset: 0, limit: 20 }),
    fetchExchangeOpen()
  ]);
  if (!profile) return { status: "UNAUTHORIZED" };
  if (!readPaymentProfile(profile)?.verified) return { status: "IDENTITY_REQUIRED" };
  if (!bank) return { status: "NO_ACCOUNT" };
  if (!open) return { status: "INVALID", message: HOURS };
  if (list.items.some(isOpen)) return { status: "INVALID", message: OPEN_REQUEST };
  if (p.amount < EXCHANGE_MIN_REX) return { status: "INVALID", message: `${EXCHANGE_MIN_REX.toLocaleString("ko-KR")} 렉스부터 정산 신청할 수 있어요.` };
  if (p.amount > summary.exchangeable) return { status: "INVALID", message: "정산 가능한 렉스보다 많이 신청할 수 없어요." };
  if (p.business) {
    if (memberDiv(profile) !== 3) return { status: "INVALID", message: NOT_BUSINESS };
    const { weekday, hour } = kstClock();
    if (weekday !== 3 || hour >= 14) return { status: "INVALID", message: BUSINESS_DAY };
  }

  const before = list.items[0]?.id ?? null;
  const sentAt = Date.now();
  const settled = () => settle(ctx.token, { before, amount: p.amount, sentAt });
  const unclear = () => {
    entry.reconcile = settled;
    return settled().catch((): ExchangeRequestResult => ({ status: "IN_PROGRESS" }));
  };

  let outcome;
  try {
    outcome = await requestWithdraw(ctx.token, context, { amount: p.amount, business: p.business });
  } catch (error) {
    if (!(error instanceof FlextvUnavailableError)) throw error;
    return unclear();
  }
  switch (outcome.kind) {
    case "REQUESTED": {
      const found = await settled().catch(() => null);
      // FLEXTV said yes: if its list does not show it yet, it is still this request.
      return found?.status === "REQUESTED" ? found : { status: "REQUESTED", requestId: null };
    }
    case "UNAUTHORIZED":
      return { status: "UNAUTHORIZED" };
    case "UNKNOWN":
      return unclear();
    default: {
      const message = { BUSINESS_DAY, NOT_BUSINESS, NO_PHONE, OPEN_REQUEST, OTHER: outcome.message ?? "FLEXTV가 정산 신청을 받지 않았어요. 잠시 후 다시 시도해 주세요." }[outcome.reason];
      return { status: "INVALID", message };
    }
  }
}

/** Whether FLEXTV took the request, from its own list (the request row is written when it is taken). */
async function settle(token: string, { before, amount, sentAt }: { before: string | null; amount: number; sentAt: number }): Promise<ExchangeRequestResult> {
  const page = await fetchWithdrawals(token, { offset: 0, limit: 10 }).catch(() => null);
  if (!page) return { status: "IN_PROGRESS" };
  const at = before === null ? page.items.length : page.items.findIndex((w) => w.id === before);
  if (at < 0 && page.items.length > 0) return { status: "IN_PROGRESS" };
  const mine = page.items.slice(0, Math.max(0, at)).find((w) => w.rex === amount);
  if (mine) return { status: "REQUESTED", requestId: mine.id };
  return Date.now() - sentAt > SETTLE_WINDOW_MS ? { status: "INVALID", message: "정산 신청을 마치지 못했어요. 잠시 후 다시 시도해 주세요." } : { status: "IN_PROGRESS" };
}

const HOURS = "지금은 정산 신청 시간이 아니에요. 매일 0시 1분부터 오후 2시 전까지 신청할 수 있어요.";
const OPEN_REQUEST = "처리 중인 정산 신청이 있어요. 끝난 뒤에 다시 신청해 주세요.";
const NOT_BUSINESS = "사업자 정산은 엔터 소속 방송인만 신청할 수 있어요.";
const BUSINESS_DAY = "사업자 정산은 매주 수요일 오후 2시 전에만 신청할 수 있어요.";
const NO_PHONE = "FLEXTV 회원 정보에 연락처가 없어요. FLEXTV에서 연락처를 등록한 뒤 신청해 주세요.";

/* ── 정산 관리 ───────────────────────────────────────────── */

export async function getExchangeHistory(raw: { page?: string }): Promise<ExchangeHistoryView | null> {
  const ctx = await studioContext();
  if (!ctx) return null;
  const wanted = Number(raw.page);
  const page = Number.isSafeInteger(wanted) && wanted >= 1 ? wanted : 1;
  const first = await fetchWithdrawals(ctx.token, { offset: (page - 1) * HISTORY_PAGE_SIZE, limit: HISTORY_PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(first.count / HISTORY_PAGE_SIZE));
  const shown = page > totalPages ? await fetchWithdrawals(ctx.token, { offset: (totalPages - 1) * HISTORY_PAGE_SIZE, limit: HISTORY_PAGE_SIZE }) : first;
  return { items: shown.items.map(rowOf), page: Math.min(page, totalPages), totalPages, total: first.count };
}

/** Cancels a 신청 of the member's own, as FLEXTV's 환전 page allows (not on Wednesdays and Thursdays). */
export async function cancelExchange(id: unknown): Promise<CancelExchangeResult> {
  const ctx = await studioContext();
  if (!ctx) return { status: "UNAUTHORIZED" };
  if (typeof id !== "string" || !/^\d{1,15}$/.test(id)) return { status: "INVALID", message: NOT_CANCELABLE };
  const { weekday } = kstClock();
  if (weekday === 3 || weekday === 4) return { status: "INVALID", message: "수요일과 목요일에는 정산 신청을 취소할 수 없어요." };
  const context = await requestDeviceContext();
  return serialize(ctx.session.userId, async () => {
    try {
      const mine = (await fetchWithdrawals(ctx.token, { offset: 0, limit: 50 })).items.find((w) => w.id === id);
      if (!mine || mine.status !== 0) return { status: "INVALID", message: NOT_CANCELABLE };
      const outcome = await cancelWithdraw(ctx.token, context, mine.id);
      if (outcome.kind === "CANCELED") return { status: "CANCELED" };
      if (outcome.kind === "UNAUTHORIZED") return { status: "UNAUTHORIZED" };
      return { status: "INVALID", message: outcome.kind === "ALREADY_HANDLED" ? "이미 처리된 정산 신청이에요." : "정산 신청을 취소하지 못했어요. 잠시 후 다시 시도해 주세요." };
    } catch (error) {
      if (error instanceof FlextvUnavailableError) return { status: "UNKNOWN" };
      throw error;
    }
  });
}

const NOT_CANCELABLE = "취소할 수 있는 정산 신청이 아니에요. 화면을 새로고침해 주세요.";
