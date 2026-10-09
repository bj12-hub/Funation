import { formatNumber } from "@/lib/format";
import { toDateString } from "@/lib/period";

/**
 * FN 충전 환불 정책 — 기본값 (일반적인 기준, 법무 검토 전). On 2026-10-08 the user asked to start with commonly used
 * rules; each number is one constant here so it can change after the legal review (docs/domains/wallet.md "환불 정책").
 * Client-safe (no server-only imports): the screens format these values, the server decides with them
 * (`refundCore.ts`). Amounts are in FN, like the charge and wallet records; the KRW refund follows from them (5).
 *
 * 1. 청약철회: requested within REFUND_WITHDRAWAL_DAYS of the payment date and none of the charge's FN used —
 *    the whole charge is cancelled, no fee.
 * 2. Otherwise the charge's paid FN still unused are refunded minus REFUND_FEE_RATE (fee rounded down to a whole FN).
 * 3. Never refunded: FN already used, and free FN (출석 보상, events — `mockCreditStore` credits). A refunded donation
 *    (퀘스트 실패 · 취소, a platform donation that failed) gives back the FN it took — free stays free; it is not a charge.
 * 4. Which paid FN are still unused: free FN count as spent first, then paid FN oldest charge first (FIFO). FN the
 *    records do not explain are settled oldest-received first (`unusedPaidFn`).
 * 5. KRW (2026-10-08 결정): a 전액 취소 returns the whole paid amount; a 수수료 공제 후 환불 returns the net FN's share of
 *    what that charge was paid — net FN ÷ the charge's FN × the charge's paid KRW, rounded down to the won (`refundKrw`).
 *
 * TBD: the payment provider and how each method returns the KRW (결제 취소 · 계좌 환불), the FN price itself.
 */

export const REFUND_POLICY_LABEL = "기본값 (일반적인 기준, 법무 검토 전)";
/**
 * 청약철회 기간: the request date may be at most this many calendar days after the payment date (server time) —
 * paid on 10/1, a request until 10/8 23:59:59 counts.
 */
export const REFUND_WITHDRAWAL_DAYS = 7;
/** 환불 수수료 on the unused paid FN of a charge that is not a 청약철회. */
export const REFUND_FEE_RATE = 0.1;
/** Processing target stated in the copy (a target only — no SLA engine). */
export const REFUND_PROCESSING_TARGET = "접수 후 3영업일 이내 처리";
/** The payment provider is TBD, so the copy does not promise how each method returns the money. */
export const REFUND_METHOD_NOTE = "결제 수단별 환불 방식은 결제 대행사 연동 후 확정";
/** 환불 정책 문서 (the page itself comes from another branch). */
export const REFUND_POLICY_HREF = "/terms/refund";
/**
 * 원화 환불 금액 of a 수수료 공제 후 환불 (2026-10-08 결정), as the copy states it (`refundKrw` computes it). A 전액
 * 취소 returns the whole paid amount.
 */
export const REFUND_KRW_RULE = "환불 FN ÷ 충전 FN × 결제 금액, 원 미만 버림";

export type RefundType = "FULL_CANCEL" | "PARTIAL" | "NOT_REFUNDABLE";
export const REFUND_TYPE_LABEL: Record<RefundType, string> = { FULL_CANCEL: "전액 취소", PARTIAL: "수수료 공제 후 환불", NOT_REFUNDABLE: "환불 불가" };

/**
 * A refund as the server stores it with a request (and with its approval). `grossFn`: the paid FN taken back from the
 * wallet; `feeFn` + `netFn` = `grossFn`; `netFn` is what the member gets back and `refundKrw` the won it comes to
 * (`refundKrw()`; how each payment method returns it: TBD).
 */
export type RefundAmounts = { type: Exclude<RefundType, "NOT_REFUNDABLE">; grossFn: number; feeFn: number; netFn: number; refundKrw: number };

/**
 * The server's refund outcome for one charge. `usedFn`: the charge's FN counted as used (FIFO); `withinPeriod`: the
 * request falls in the 청약철회 period; `paidKrw`: what the charge was paid. NOT_REFUNDABLE has 0 for the amounts.
 */
export type RefundQuote = {
  type: RefundType;
  chargeFn: number;
  paidKrw: number;
  usedFn: number;
  withinPeriod: boolean;
  grossFn: number;
  feeFn: number;
  netFn: number;
  refundKrw: number;
};

/**
 * One charge in 남은 FN 정리 (영구 정지, 2026-10-08 결정): its refund under this policy and the charge it is for.
 * `chargedAt`: local "YYYY-MM-DD HH:mm:ss"; `chargeFn` / `paidKrw`: the charge's FN and paid KRW.
 */
export type ChargeRefundLine = RefundAmounts & { chargeId: string; chargedAt: string; methodLabel: string; chargeFn: number; paidKrw: number };

/** "10%" */
export const REFUND_FEE_PERCENT = `${Math.round(REFUND_FEE_RATE * 1000) / 10}%`;

/** The refund fee, rounded down to a whole FN (in the member's favour; the inner round only removes float noise). */
export function refundFee(grossFn: number): number {
  return Math.floor(Math.round(grossFn * REFUND_FEE_RATE * 1e6) / 1e6);
}

/**
 * 원화 환불 금액 (2026-10-08 결정): FULL_CANCEL returns the whole paid amount; PARTIAL the net FN's share of it —
 * `netFn` ÷ `chargeFn` × `paidKrw`, rounded down to the won (30,000 FN paid 33,000원, 4,500 FN refunded → 4,950원).
 * Exact integer arithmetic (BigInt): a float share like 0.29 × 100 = 28.999… never loses a won, and large charges
 * (products past 2^53) stay exact. Amounts are whole FN and won.
 */
export function refundKrw(type: RefundAmounts["type"], input: { netFn: number; chargeFn: number; paidKrw: number }): number {
  const { netFn, chargeFn, paidKrw } = input;
  if (paidKrw <= 0 || chargeFn <= 0 || netFn <= 0) return 0;
  if (type === "FULL_CANCEL") return paidKrw;
  // BigInt division truncates, which is rounding down for these positive amounts.
  const whole = (n: number) => BigInt(Math.floor(n));
  return Number((whole(Math.min(netFn, chargeFn)) * whole(paidKrw)) / whole(chargeFn));
}

/** Whether a request made at `requestedAt` is within the 청약철회 period of a charge paid at `chargedAt` (local "YYYY-MM-DD …"). */
export function withinWithdrawalPeriod(chargedAt: string, requestedAt: Date): boolean {
  const [y, m, d] = chargedAt.slice(0, 10).split("-").map(Number);
  return toDateString(requestedAt) <= toDateString(new Date(y, m - 1, d + REFUND_WITHDRAWAL_DAYS));
}

/** Policy 1–3 and 5 for one charge, given how many of its paid FN are still unused and what it was paid (KRW). */
export function quoteRefund(input: { chargeFn: number; paidKrw: number; unusedFn: number; withinPeriod: boolean }): RefundQuote {
  const { chargeFn, paidKrw, withinPeriod } = input;
  const grossFn = Math.max(0, Math.min(chargeFn, Math.floor(input.unusedFn)));
  const base = { chargeFn, paidKrw, usedFn: chargeFn - grossFn, withinPeriod };
  if (grossFn === 0) return { ...base, type: "NOT_REFUNDABLE", grossFn: 0, feeFn: 0, netFn: 0, refundKrw: 0 };
  if (withinPeriod && grossFn === chargeFn) {
    return { ...base, type: "FULL_CANCEL", grossFn, feeFn: 0, netFn: grossFn, refundKrw: refundKrw("FULL_CANCEL", { netFn: grossFn, chargeFn, paidKrw }) };
  }
  const feeFn = refundFee(grossFn);
  const netFn = grossFn - feeFn;
  return { ...base, type: "PARTIAL", grossFn, feeFn, netFn, refundKrw: refundKrw("PARTIAL", { netFn, chargeFn, paidKrw }) };
}

/** The stored part of a refundable quote (explicit fields). */
export function refundAmounts(q: RefundQuote): RefundAmounts | null {
  return q.type === "NOT_REFUNDABLE" ? null : { type: q.type, grossFn: q.grossFn, feeFn: q.feeFn, netFn: q.netFn, refundKrw: q.refundKrw };
}

export const sameRefund = (a: Pick<RefundAmounts, "type" | "grossFn" | "netFn">, b: Pick<RefundAmounts, "type" | "grossFn" | "netFn">) =>
  a.type === b.type && a.grossFn === b.grossFn && a.netFn === b.netFn;

// ── FIFO (policy 4) ──────────────────────────────────────────────────────────

/**
 * One balance change of an account. PAID: a completed charge; FREE: FN credited without a payment; SPEND: FN spent or
 * held (a donation; `id` names it for a RETURN); RETURN: a spend's FN given back (퀘스트 실패 · 취소, a platform
 * donation that failed); RECLAIM: a charge refund (an approved request, or 남은 FN 정리) taking FN back from that
 * charge; FORFEIT: free FN written off by 남은 FN 정리 (영구 정지) — never paid FN. `at`: local "YYYY-MM-DD HH:mm[:ss]".
 */
export type FnLedgerEvent =
  | { kind: "PAID"; chargeId: string; at: string; fn: number }
  | { kind: "FREE"; at: string; fn: number }
  | { kind: "SPEND"; at: string; fn: number; id?: string }
  | { kind: "RETURN"; spendId: string; at: string; fn: number }
  | { kind: "RECLAIM"; chargeId: string; at: string; fn: number }
  | { kind: "FORFEIT"; at: string; fn: number };

const stamp = (at: string) => (at.length === 16 ? `${at}:00` : at);

/** FN received at one time: a charge's paid FN (`chargeId`) or free FN (`null`). */
type Lot = { chargeId: string | null; left: number };

/** Takes up to `fn` from `lots` in their order; returns what came from which lot. */
function take(lots: Lot[], fn: number): { lot: Lot; fn: number }[] {
  const parts: { lot: Lot; fn: number }[] = [];
  let rest = fn;
  for (const lot of lots) {
    if (rest <= 0) break;
    const n = Math.min(lot.left, rest);
    if (n <= 0) continue;
    lot.left -= n;
    rest -= n;
    parts.push({ lot, fn: n });
  }
  return parts;
}

/**
 * How many paid FN of each charge are still unused, as of `now`. Every credit is a dated lot (a charge's paid FN, or
 * free FN), and events run in time order — credits before spends of the same second, a RETURN after them (its own spend
 * is always before it). Server-side only.
 *
 * - Only events up to `now` are history: a record dated later has not happened yet as far as the ledger can tell, so it
 *   explains nothing about the balance now — whatever it changed is left to the reconcile below. (The mock's sample rows
 *   are dated once, before the wallet store was created — `sampleTimes` — so none is dated later than a live record.)
 * - SPEND (policy 4): free FN first, then paid FN oldest charge first — only FN the member had at that time.
 * - RETURN: gives back exactly the FN its spend took, to the same lots — free FN stay free, a charge's FN go back to
 *   that charge. A held donation that failed is not rewritten as never spent: spends made while it held FN used the
 *   FN that were really there. A RETURN whose spend is not in the events changes nothing.
 * - Reconcile: the balance stays authoritative. FN in the balance that no record explains are not a charge's (never
 *   refundable). FN the records explain but that are no longer in the balance (a shortfall) left through spends the
 *   records do not show. Every balance change leaves a record (docs/domains/wallet.md), so those spends belong to the
 *   history before the records add up — in the mock, the sample history, whose balance never matched its charges and
 *   donations — not to FN received since. The shortfall is therefore settled from the oldest lots still held, by when
 *   they were received, paid and free alike (FIFO by acquisition): later FN are touched only once everything older is
 *   gone. Free-first is the rule for a recorded spend at a known time; applied to the shortfall it would let FN received
 *   now (an event reward) pay for spending that happened before them, leaving older paid FN refundable in their place.
 */
export function unusedPaidFn(events: FnLedgerEvent[], balance: number, now?: Date): Map<string, number> {
  const spentAt = new Map(events.flatMap((e) => (e.kind === "SPEND" && e.id ? [[e.id, stamp(e.at)] as const] : [])));
  const at = (e: FnLedgerEvent) => {
    const own = e.kind === "RETURN" ? spentAt.get(e.spendId) : undefined;
    return own && own > stamp(e.at) ? own : stamp(e.at);
  };
  const asOf = now ? `${toDateString(now)} ${now.toTimeString().slice(0, 8)}` : null;
  const rank = (e: FnLedgerEvent) => (e.kind === "PAID" || e.kind === "FREE" ? 0 : e.kind === "RETURN" ? 2 : 1);
  const ordered = events.filter((e) => asOf === null || at(e) <= asOf).sort((a, b) => at(a).localeCompare(at(b)) || rank(a) - rank(b));
  const lots: Lot[] = []; // in the order received
  const free = () => lots.filter((l) => l.chargeId === null);
  const paid = () => lots.filter((l) => l.chargeId !== null);
  const taken = new Map<string, { lot: Lot; fn: number }[]>();
  for (const e of ordered) {
    if (e.kind === "PAID") lots.push({ chargeId: e.chargeId, left: e.fn });
    else if (e.kind === "FREE") lots.push({ chargeId: null, left: e.fn });
    else if (e.kind === "SPEND") {
      const fromFree = take(free(), e.fn);
      const parts = [...fromFree, ...take(paid(), e.fn - fromFree.reduce((sum, p) => sum + p.fn, 0))];
      if (e.id) taken.set(e.id, parts);
    } else if (e.kind === "RETURN") {
      let rest = e.fn;
      for (const part of taken.get(e.spendId) ?? []) {
        const back = Math.min(part.fn, rest);
        part.lot.left += back;
        part.fn -= back;
        rest -= back;
      }
    } else if (e.kind === "FORFEIT") take(free(), e.fn);
    else {
      const lot = lots.find((l) => l.chargeId === e.chargeId);
      if (lot) lot.left -= Math.min(lot.left, e.fn);
    }
  }
  const tracked = lots.reduce((sum, l) => sum + l.left, 0);
  if (tracked > Math.max(0, balance)) take(lots, tracked - Math.max(0, balance));
  return new Map(lots.flatMap((l) => (l.chargeId === null ? [] : [[l.chargeId, l.left] as const])));
}

// ── Copy ─────────────────────────────────────────────────────────────────────

/** The member's policy summary (refund popup). */
export const REFUND_POLICY_LINES: string[] = [
  `결제일로부터 ${REFUND_WITHDRAWAL_DAYS}일 이내에 요청하고 충전한 FN을 하나도 쓰지 않았다면 전액 취소돼요 (수수료 없음).`,
  `그 밖에는 이 충전에서 남은 FN에서 환불 수수료 ${REFUND_FEE_PERCENT}를 빼고 환불해요. 수수료의 1 FN 미만은 버려요.`,
  `수수료를 뺀 FN은 이 충전의 결제 금액에 비례해 원화로 환불해요 (${REFUND_KRW_RULE}).`,
  "이미 사용한 FN과 출석 보상 · 이벤트로 받은 무료 FN은 환불되지 않아요. 무료 FN을 먼저, 그다음 먼저 충전한 FN부터 쓴 것으로 계산해요.",
  `${REFUND_PROCESSING_TARGET}를 목표로 해요. 원래 결제 수단으로 환불하며, ${REFUND_METHOD_NOTE}돼요.`
];

/** One-line summary for the admin console. */
export const REFUND_POLICY_SUMMARY = `청약철회(결제일로부터 ${REFUND_WITHDRAWAL_DAYS}일 이내 · 미사용) 전액 취소 · 그 밖에는 남은 충전 FN에서 수수료 ${REFUND_FEE_PERCENT}(1 FN 미만 버림) 공제, 원화 환불 금액은 ${REFUND_KRW_RULE} · 사용한 FN과 무료 FN은 환불 불가 · 무료 FN 먼저, 그다음 오래된 충전부터 사용으로 계산 · ${REFUND_PROCESSING_TARGET} 목표`;

/** "전액 취소 · 30,000 FN · 33,000원" / "수수료 공제 후 환불 · 4,500 FN · 4,950원 (남은 5,000 FN − 수수료 500 FN)" */
export function describeRefund(a: RefundAmounts): string {
  const won = `${formatNumber(a.refundKrw)}원`;
  return a.type === "FULL_CANCEL"
    ? `${REFUND_TYPE_LABEL.FULL_CANCEL} · ${formatNumber(a.netFn)} FN · ${won}`
    : `${REFUND_TYPE_LABEL.PARTIAL} · ${formatNumber(a.netFn)} FN · ${won} (남은 ${formatNumber(a.grossFn)} FN − 수수료 ${formatNumber(a.feeFn)} FN)`;
}
