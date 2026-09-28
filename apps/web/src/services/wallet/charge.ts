"use server";

import { toDateString } from "@/lib/period";
import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getSession } from "@/lib/session";
import { mockAccount } from "@/services/account/mockStore";
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
import { mockWallet } from "./mockWalletStore";

/**
 * FN charge (Payment → FN issuance → Wallet Transaction, docs/domains/payment.md).
 *
 * Server Actions: callable from the browser, so every action re-checks the session and validates
 * its input. Prices, balances and results are decided here, never in the browser. `requestCharge`
 * is idempotent per `idempotencyKey`: a retried or double-submitted request returns the first
 * result instead of charging again.
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
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  if (mockWallet.chargeTermsAgreedAt === null) return { status: "TERMS_REQUIRED" };

  const parsed = parseRequest(input);
  if (!parsed) return { status: "INVALID" };
  const { fnAmount, methodId, idempotencyKey } = parsed;

  // Idempotency: one key ⇒ one outcome.
  const fingerprint = JSON.stringify({ fnAmount, methodId });
  const previous = mockWallet.idempotency[idempotencyKey];
  if (previous) {
    if (previous.fingerprint !== fingerprint) return { status: "CONFLICT" };
    return previous.result ?? { status: "IN_PROGRESS" };
  }
  mockWallet.idempotency[idempotencyKey] = { fingerprint, result: null };

  await mockDelay(900); // payment provider round trip
  const failure = mockFailure(fnAmount, methodId);
  const result: ChargeResult = failure ? { status: "FAILED", code: failure } : completeCharge(fnAmount, methodId);
  mockWallet.idempotency[idempotencyKey].result = result;
  return result;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isValidAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= MIN_AMOUNT && value <= MAX_INPUT;
}

function parseRequest(input: unknown): { fnAmount: number; methodId: PaymentMethodId; idempotencyKey: string } | null {
  if (typeof input !== "object" || input === null) return null;
  const { amount, methodId, idempotencyKey } = input as { amount?: ChargeAmountInput; methodId?: unknown; idempotencyKey?: unknown };
  if (typeof idempotencyKey !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(idempotencyKey)) return null;
  if (typeof methodId !== "string" || !(methodId in PAYMENT_METHODS)) return null;
  if (typeof amount !== "object" || amount === null) return null;

  let fnAmount: number | null = null;
  if ("packageId" in amount) fnAmount = MOCK_PACKAGES.find((fn) => `fn-${fn}` === amount.packageId) ?? null;
  else if ("customAmount" in amount && isValidAmount(amount.customAmount)) fnAmount = amount.customAmount;
  return fnAmount === null ? null : { fnAmount, methodId: methodId as PaymentMethodId, idempotencyKey };
}

function completeCharge(fnAmount: number, methodId: PaymentMethodId): ChargeResult {
  const now = new Date();
  const time = now.toTimeString().slice(0, 8);
  const chargedAt = `${toDateString(now)} ${time}`;
  const transactionId = `TXN-${toDateString(now).replaceAll("-", "")}-${String(now.getTime() % 100_000).padStart(5, "0")}`;
  const price = mockPrice(fnAmount);
  const method = PAYMENT_METHODS[methodId];

  mockAccount.fnBalance += fnAmount;
  mockWallet.charges.unshift({
    id: `ch-${now.getTime()}`,
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
