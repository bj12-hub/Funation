"use server";

import { toDateString } from "@/lib/period";
import { memberKeyOf, ownEntry } from "@/lib/records";
import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getSession } from "@/lib/session";
import { mockAccount } from "@/services/account/mockStore";
import { recordUncreditedCharge } from "./chargeCore";
import {
  CHARGE_CONSENTS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_IDS,
  type ChargeAmountInput,
  type ChargeErrorCode,
  type ChargeOptions,
  type ChargeQuote,
  type ChargeResult,
  type PaymentMethodId
} from "./chargeTypes";
import { beginCredit } from "./inFlightCore";
import { mockWallet } from "./mockWalletStore";
import { notify } from "@/services/notifications/notificationCore";

/**
 * FN charge (Payment → FN issuance → Wallet Transaction, docs/domains/payment.md).
 *
 * Server Actions: callable from the browser, so every action re-checks the session and validates
 * its input. Prices, balances and results are decided here, never in the browser. `requestCharge`
 * is idempotent per `idempotencyKey`, per member: a retried or double-submitted request returns the first
 * result instead of charging again, and another member sending the same key gets a charge of their own.
 *
 * 2026-10-10 결정: while the provider call runs the charge is in progress (./inFlightCore.ts) and 회원 탈퇴 waits for
 * it. Its FN land only on the account that made it, while that account is still active: a payment that completes after
 * that account withdrew is never credited (not to the withdrawn account, not to a 재가입 account) and is kept for the
 * console (./chargeCore.ts). What happens to its KRW (PG 취소 · 환불) is TBD.
 *
 * TBD (docs/product/open-decisions.md): payment provider, FN packages, FN/KRW conversion, limits.
 * The mock follows the Figma samples (5,000 FN → 5,500원 …) and completes payments instantly.
 */

const MIN_AMOUNT = 1_000; // Figma 817:7936 "최소 1,000 FN부터 충전할 수 있습니다." — server-owned
const MAX_INPUT = 999_999_999;

export async function getChargeOptions(): Promise<ChargeOptions | null> {
  if (!USE_MOCK) throw new Error("Charge API is not connected yet.");
  if (!(await getSession())) return null;
  await mockDelay(300);
  return {
    balance: mockAccount.fnBalance,
    termsAgreed: mockWallet.chargeTermsAgreedAt !== null,
    packages: MOCK_PACKAGES.map((fnAmount) => ({ id: `fn-${fnAmount}`, fnAmount, price: mockPrice(fnAmount) })),
    savedMethods: ["KAKAO_PAY", "NAVER_PAY"],
    availableMethods: PAYMENT_METHOD_IDS,
    minAmount: MIN_AMOUNT
  };
}

/** KRW price for a custom amount (Figma 672:2 "환산 금액"). */
export async function quoteCharge(amount: unknown): Promise<ChargeQuote | null> {
  if (!USE_MOCK) throw new Error("Charge API is not connected yet.");
  if (!(await getSession())) return null;
  if (!isValidAmount(amount)) return { status: "INVALID", minAmount: MIN_AMOUNT };
  return { status: "OK", fnAmount: amount, price: mockPrice(amount) };
}

export async function agreeChargeTerms(consents: unknown): Promise<{ status: "AGREED" | "INVALID" | "UNAUTHORIZED" }> {
  if (!USE_MOCK) throw new Error("Charge API is not connected yet.");
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  if (typeof consents !== "object" || consents === null) return { status: "INVALID" };
  const values = consents as Record<string, unknown>;
  if (CHARGE_CONSENTS.some((c) => c.required && values[c.key] !== true)) return { status: "INVALID" };
  await mockDelay(300);
  // TODO: the backend should store the terms versions and timestamps for auditability.
  mockWallet.chargeTermsAgreedAt = new Date().toISOString();
  mockWallet.marketingOptIn = values.marketing === true;
  return { status: "AGREED" };
}

export async function requestCharge(input: unknown): Promise<ChargeResult> {
  if (!USE_MOCK) throw new Error("Charge API is not connected yet.");
  const session = await getSession();
  if (!session) return { status: "UNAUTHORIZED" };
  if (mockWallet.chargeTermsAgreedAt === null) return { status: "TERMS_REQUIRED" };

  const parsed = parseRequest(input);
  if (!parsed) return { status: "INVALID" };
  const { fnAmount, methodId, idempotencyKey } = parsed;

  // Idempotency: one key ⇒ one outcome, per member — another member's key never answers or blocks this request.
  const fingerprint = JSON.stringify({ fnAmount, methodId });
  const memberKey = memberKeyOf(session.userId, idempotencyKey);
  const previous = ownEntry(mockWallet.idempotency, memberKey);
  if (previous) {
    if (previous.fingerprint !== fingerprint) return { status: "CONFLICT" };
    return previous.result ?? { status: "IN_PROGRESS" };
  }
  // In progress from here until the provider answers: 회원 탈퇴 waits for it (2026-10-10 결정). An account that withdrew
  // after its session was read sends nothing to the provider.
  const flight = beginCredit("CHARGE");
  if (!flight) return { status: "UNAUTHORIZED" };
  // Held by reference: a 재가입 during the await moves the entry to the withdrawn account's own id (account/rejoin.ts).
  const entry: { fingerprint: string; result: ChargeResult | null } = (mockWallet.idempotency[memberKey] = { fingerprint, result: null });
  const requestedAt = localStamp(new Date());

  try {
    await mockDelay(900); // payment provider round trip
    // From here nothing awaits: whether the account is still there, the credit and the end of "in progress" are one step.
    const failure = mockFailure(fnAmount, methodId);
    let result: ChargeResult;
    if (failure) result = { status: "FAILED", code: failure };
    else if (flight.landsHere()) result = completeCharge(fnAmount, methodId);
    else {
      // The account withdrew while the provider answered (회원 탈퇴 waits for this charge, so only a withdrawal that went
      // around that check gets here): the payment went through and its FN go to nobody — the console lists it.
      const transactionId = nextTransactionId(new Date());
      recordUncreditedCharge({
        id: `ch-${transactionId}`,
        transactionId,
        chargedAt: requestedAt,
        methodLabel: PAYMENT_METHODS[methodId].name,
        fnAmount,
        paidAmount: mockPrice(fnAmount),
        account: flight.account
      });
      result = { status: "UNAUTHORIZED" };
    }
    entry.result = result;
    return result;
  } finally {
    flight.end();
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isValidAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= MIN_AMOUNT && value <= MAX_INPUT;
}

function parseRequest(input: unknown): { fnAmount: number; methodId: PaymentMethodId; idempotencyKey: string } | null {
  if (typeof input !== "object" || input === null) return null;
  const { amount, methodId, idempotencyKey } = input as { amount?: ChargeAmountInput; methodId?: unknown; idempotencyKey?: unknown };
  if (typeof idempotencyKey !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(idempotencyKey)) return null;
  if (typeof methodId !== "string" || !Object.hasOwn(PAYMENT_METHODS, methodId)) return null;
  if (typeof amount !== "object" || amount === null) return null;

  let fnAmount: number | null = null;
  if ("packageId" in amount) fnAmount = MOCK_PACKAGES.find((fn) => `fn-${fn}` === amount.packageId) ?? null;
  else if ("customAmount" in amount && isValidAmount(amount.customAmount)) fnAmount = amount.customAmount;
  return fnAmount === null ? null : { fnAmount, methodId: methodId as PaymentMethodId, idempotencyKey };
}

const localStamp = (d: Date) => `${toDateString(d)} ${d.toTimeString().slice(0, 8)}`;

/**
 * Next number of the day, so two charges never share an id (a time-based suffix repeated every 100 s) — also not with a
 * charge paid after its account withdrew.
 */
function nextTransactionId(now: Date) {
  const prefix = `TXN-${toDateString(now).replaceAll("-", "")}-`;
  const used = [...mockWallet.charges, ...mockWallet.uncreditedCharges].flatMap((c) => (c.transactionId?.startsWith(prefix) ? [Number(c.transactionId.slice(prefix.length))] : []));
  return `${prefix}${String(Math.max(0, ...used) + 1).padStart(5, "0")}`;
}

function completeCharge(fnAmount: number, methodId: PaymentMethodId): ChargeResult {
  const now = new Date();
  const chargedAt = localStamp(now);
  const transactionId = nextTransactionId(now);
  const price = mockPrice(fnAmount);
  const method = PAYMENT_METHODS[methodId];

  mockAccount.fnBalance += fnAmount;
  mockWallet.charges.unshift({
    id: `ch-${transactionId}`,
    chargedAt,
    // History rows use an emoji mark (640:2): 💳 cards, 📱 app payments, otherwise the method's own emoji.
    methodEmoji: /\p{Extended_Pictographic}/u.test(method.glyph) ? method.glyph : methodId.endsWith("_PAY") ? "📱" : "💳",
    methodLabel: method.name,
    methodDetail: null,
    fnAmount,
    paidAmount: price,
    status: "COMPLETED",
    transactionId
  });
  notify({ kind: "CHARGE", title: "FN 충전이 완료됐어요", body: `${fnAmount.toLocaleString("ko-KR")} FN · ${method.name}`, href: "/wallet/charges", dedupeKey: `charge:${transactionId}` });
  return { status: "COMPLETED", transactionId, fnAmount, price, methodId, balance: mockAccount.fnBalance };
}

// ── Mock data ────────────────────────────────────────────────────────────────

/** Figma 595:1869 presets. */
const MOCK_PACKAGES = [5_000, 30_000, 50_000];

/** Figma samples price 1 FN at 1.1원 (5,000 FN → 5,500원). The real rate is TBD. */
function mockPrice(fnAmount: number) {
  return Math.round(fnAmount * 1.1);
}

/**
 * Mock-only scenarios so each 결제 취소 state (739:*) can be seen in development.
 * Real failures come from the payment provider.
 */
function mockFailure(fnAmount: number, methodId: PaymentMethodId): ChargeErrorCode | null {
  if (fnAmount > 1_000_000) return "LIMIT-OVER-429";
  if (methodId === "PHONE") return "SYSTEM-TEMP-500";
  if (methodId === "VIRTUAL_ACCOUNT") return "BANK-MAINT-503";
  if (methodId === "CULTURELAND") return "METHOD-LOCK-403";
  if (methodId === "TMONEY") return "PAY-STOP-401";
  return null;
}
