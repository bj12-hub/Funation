import { cookies } from "next/headers";
import { requestDeviceContext } from "@/lib/flextv/request";
import {
  REX_MAX,
  REX_MIN,
  REX_PRESETS,
  REX_UNIT_PRICE,
  depositBonus,
  fetchBalance,
  fetchBlockedMethods,
  fetchCheckoutStatus,
  fetchDepositAccount,
  fetchDepositBonusRules,
  fetchPaymentProfile,
  startDeposit,
  startWindowPayment,
  type FlextvPayMethod,
  type PaymentProfile
} from "@/lib/flextv/wallet";
import { getFlextvAccessToken, getSession } from "@/lib/session";
import {
  CHARGE_CONSENTS,
  type ChargeEligibility,
  type ChargeOptions,
  type ChargeQuote,
  type ChargeResult,
  type ChargeStatusResult,
  type PaymentMethodId
} from "./chargeTypes";

/**
 * 렉스 충전 on the FLEXTV backend (phase 2, docs/development/flextv-backend.md "2단계"), behind the actions of
 * ./charge.ts. FLEXTV decides who may charge and credits the 렉스; Ssumnation starts the checkout as FLEXTV's own web
 * does and reads the outcome back:
 * - 카카오페이 (and 카드 · 휴대폰 for FLEXTV's VIP members) through Payletter's window — the browser opens `payUrl`,
 *   Payletter tells FLEXTV, and `checkStatus` reads FLEXTV's checkout until it is completed.
 * - 무통장입금: a request FLEXTV matches with the deposit later; the member gets the account to transfer to.
 *
 * Not connected yet: 내통장결제 (Hecto's SDK and callback), 해외카드 (NICE), 현금영수증, refunds (FLEXTV takes them
 * through its 1:1 문의).
 */

const METHOD: Partial<Record<PaymentMethodId, FlextvPayMethod>> = { KAKAO_PAY: "kakaopay", CARD: "creditcard", PHONE: "mobile", BANK_TRANSFER: "virtualaccount" };
/** Payletter takes cards and phones from FLEXTV's VIP members only (tv-ui `getApiVersion`); others go through Hecto. */
const VIP_ONLY: readonly PaymentMethodId[] = ["CARD", "PHONE"];

export const packageIdOf = (rex: number) => `rex-${rex}`;

export function eligibilityOf(profile: PaymentProfile): ChargeEligibility {
  if (profile.blocked) return "UNAVAILABLE";
  if (!profile.verified) return "IDENTITY_REQUIRED";
  if (profile.minor) return "MINOR";
  return "OK";
}

export function methodsFor(profile: PaymentProfile, blocked: Set<FlextvPayMethod>): PaymentMethodId[] {
  const offered: PaymentMethodId[] = ["KAKAO_PAY", ...(profile.vip ? VIP_ONLY : []), "BANK_TRANSFER"];
  return offered.filter((id) => !blocked.has(METHOD[id]!));
}

async function member() {
  const session = await getSession();
  const token = session && (await getFlextvAccessToken());
  return session && token ? { session, token } : null;
}

/* ── 충전 약관 ─────────────────────────────────────────────
 * FLEXTV has no record of Ssumnation's charge terms yet: the agreement is kept in an httpOnly cookie per member, so
 * the sheet shows once per browser. TBD (FLEXTV side): store the agreement with the member.
 */
const TERMS_COOKIE = "ssumnation_charge_terms";

async function termsAgreed(userId: string) {
  return (await cookies()).get(TERMS_COOKIE)?.value === userId;
}

export async function agreeTerms(consents: unknown): Promise<{ status: "AGREED" | "INVALID" | "UNAUTHORIZED" }> {
  const session = await getSession();
  if (!session) return { status: "UNAUTHORIZED" };
  if (typeof consents !== "object" || consents === null) return { status: "INVALID" };
  const values = consents as Record<string, unknown>;
  if (CHARGE_CONSENTS.some((c) => c.required && values[c.key] !== true)) return { status: "INVALID" };
  (await cookies()).set(TERMS_COOKIE, session.userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365
  });
  return { status: "AGREED" };
}

/* ── Options and quote ───────────────────────────────────── */

export async function chargeOptions(): Promise<ChargeOptions | null> {
  const m = await member();
  if (!m) return null;
  const [balance, profile, blocked, bonusRules] = await Promise.all([
    fetchBalance(m.token),
    fetchPaymentProfile(m.token),
    fetchBlockedMethods().catch(() => new Set<FlextvPayMethod>()),
    fetchDepositBonusRules(m.token).catch(() => [])
  ]);
  // FLEXTV no longer accepts the token: the modal sends the member to sign in.
  if (balance === null || !profile) return null;
  const methods = methodsFor(profile, blocked);
  return {
    balance,
    termsAgreed: await termsAgreed(m.session.userId),
    packages: REX_PRESETS.map((rex) => ({ id: packageIdOf(rex), fnAmount: rex, price: rex * REX_UNIT_PRICE })),
    savedMethods: methods,
    availableMethods: methods,
    minAmount: REX_MIN,
    eligibility: eligibilityOf(profile),
    depositBonus: bonusRules.filter((r) => r.lexPoint > 0).map((r) => ({ minAmount: r.amount, percent: r.lexPoint }))
  };
}

const isRexAmount = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= REX_MIN && value <= REX_MAX;

export async function quote(amount: unknown): Promise<ChargeQuote | null> {
  if (!(await getSession())) return null;
  return isRexAmount(amount) ? { status: "OK", fnAmount: amount, price: amount * REX_UNIT_PRICE } : { status: "INVALID", minAmount: REX_MIN };
}

/* ── Request ─────────────────────────────────────────────── */

type Parsed = { rex: number; methodId: PaymentMethodId; idempotencyKey: string; depositorName: string | null };

export function parseChargeRequest(input: unknown): Parsed | null {
  if (typeof input !== "object" || input === null) return null;
  const { amount, methodId, idempotencyKey, depositorName } = input as Record<string, unknown>;
  if (typeof idempotencyKey !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(idempotencyKey)) return null;
  if (typeof methodId !== "string" || !Object.hasOwn(METHOD, methodId)) return null;
  if (typeof amount !== "object" || amount === null) return null;
  const a = amount as Record<string, unknown>;
  const rex = "packageId" in a ? (REX_PRESETS.find((r) => packageIdOf(r) === a.packageId) ?? null) : isRexAmount(a.customAmount) ? a.customAmount : null;
  if (rex === null) return null;
  let name: string | null = null;
  if (methodId === "BANK_TRANSFER") {
    // 입금자명 as the bank shows it: FLEXTV matches the deposit by it.
    name = typeof depositorName === "string" ? depositorName.trim() : "";
    if (!name || name.length > 20 || /[\u0000-\u001f<>]/.test(name)) return null;
  }
  return { rex, methodId: methodId as PaymentMethodId, idempotencyKey, depositorName: name };
}

/**
 * One key ⇒ one checkout, per member, kept by this server for 30 minutes: a double click or a retry never opens a
 * second checkout. FLEXTV itself has no such key — a second server would not know the first one's answer.
 */
const KEY_TTL_MS = 30 * 60 * 1000;
type KeyEntry = { at: number; fingerprint: string; result: Promise<ChargeResult> };
/** Checkouts started here: whose they are and what they were for (FLEXTV answers the amounts to their owner only). */
type Started = { at: number; userId: string; rex: number; price: number; methodId: PaymentMethodId };
const g = globalThis as typeof globalThis & { __ssumnationFlextvChargeKeys?: Map<string, KeyEntry>; __ssumnationFlextvCheckouts?: Map<string, Started> };
const keys = (g.__ssumnationFlextvChargeKeys ??= new Map());
const checkouts = (g.__ssumnationFlextvCheckouts ??= new Map());

function prune(now: number) {
  for (const [k, e] of keys) if (now - e.at > KEY_TTL_MS) keys.delete(k);
  for (const [k, e] of checkouts) if (now - e.at > KEY_TTL_MS * 4) checkouts.delete(k);
}

export async function requestCharge(input: unknown): Promise<ChargeResult> {
  const m = await member();
  if (!m) return { status: "UNAUTHORIZED" };
  if (!(await termsAgreed(m.session.userId))) return { status: "TERMS_REQUIRED" };
  const parsed = parseChargeRequest(input);
  if (!parsed) return { status: "INVALID" };

  const now = Date.now();
  prune(now);
  const keyOf = `${m.session.userId}:${parsed.idempotencyKey}`;
  const fingerprint = JSON.stringify([parsed.rex, parsed.methodId, parsed.depositorName]);
  const previous = keys.get(keyOf);
  if (previous) return previous.fingerprint === fingerprint ? previous.result : { status: "CONFLICT" };

  const result = start(m.session.userId, m.token, parsed);
  keys.set(keyOf, { at: now, fingerprint, result });
  // A failure before FLEXTV answered opened nothing: the same key may try again.
  result.catch(() => keys.delete(keyOf));
  return result;
}

async function start(userId: string, token: string, { rex, methodId, depositorName }: Parsed): Promise<ChargeResult> {
  const [profile, blocked] = await Promise.all([fetchPaymentProfile(token), fetchBlockedMethods().catch(() => new Set<FlextvPayMethod>())]);
  if (!profile) return { status: "UNAUTHORIZED" };
  const eligibility = eligibilityOf(profile);
  if (eligibility !== "OK") return { status: "NOT_ELIGIBLE", eligibility };
  if (!methodsFor(profile, blocked).includes(methodId)) return { status: "FAILED", code: "METHOD-LOCK-403" };

  const context = await requestDeviceContext();
  const price = rex * REX_UNIT_PRICE;

  if (methodId === "BANK_TRANSFER") {
    const outcome = await startDeposit(token, context, { rex, depositor: depositorName! });
    if (outcome.kind === "DEPOSIT") {
      const [account, rules] = await Promise.all([fetchDepositAccount().catch(() => null), fetchDepositBonusRules(token).catch(() => [])]);
      return {
        status: "DEPOSIT_REQUESTED",
        fnAmount: rex,
        price,
        bonusFn: depositBonus(rules, rex),
        depositorName: depositorName!,
        account: account && { bank: account.bank, number: account.account, holder: account.holder }
      };
    }
    return refused(outcome);
  }

  const outcome = await startWindowPayment(token, context, { rex, method: METHOD[methodId] as Exclude<FlextvPayMethod, "virtualaccount"> });
  if (outcome.kind === "PAYMENT_WINDOW") {
    checkouts.set(outcome.checkoutId, { at: Date.now(), userId, rex, price, methodId });
    return { status: "PAYMENT_STARTED", checkoutId: outcome.checkoutId, payUrl: outcome.payUrl, fnAmount: rex, price, methodId };
  }
  return refused(outcome);
}

function refused(outcome: { kind: string; message?: string }): ChargeResult {
  if (outcome.kind === "REFUSED" && outcome.message?.includes("대기중인 요청")) return { status: "FAILED", code: "DEPOSIT-WAITING-409" };
  if (outcome.kind === "REFUSED" && outcome.message?.includes("입금자명")) return { status: "INVALID" };
  // FLEXTV checked the same profile, so its "Cannot process payment" here is the provider not answering.
  return { status: "FAILED", code: "SYSTEM-TEMP-500" };
}

/* ── Completion ──────────────────────────────────────────── */

export async function checkStatus(checkoutId: unknown): Promise<ChargeStatusResult> {
  const m = await member();
  if (!m) return { status: "UNAUTHORIZED" };
  if (typeof checkoutId !== "string" || !/^\d{1,20}$/.test(checkoutId)) return { status: "INVALID" };
  const started = checkouts.get(checkoutId);
  if (started && started.userId !== m.session.userId) return { status: "INVALID" };

  const state = await fetchCheckoutStatus(m.token, checkoutId);
  if (state.kind === "PENDING") return { status: "PENDING" };
  if (state.kind === "FAILED") return { status: "FAILED", code: "SYSTEM-TEMP-500" };
  const balance = await fetchBalance(m.token).catch(() => null);
  return {
    status: "COMPLETED",
    transactionId: state.trxNo ?? checkoutId,
    fnAmount: state.rex ?? started?.rex ?? 0,
    price: state.price ?? started?.price ?? 0,
    methodId: started?.methodId ?? "KAKAO_PAY",
    balance: balance ?? 0
  };
}
