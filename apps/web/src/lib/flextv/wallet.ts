import { requestFrom, type DeviceContext } from "./auth";
import { FlextvUnavailableError, flextvRequest, isRecord, type FlextvResponse } from "./client";

/**
 * FLEXTV's 렉스 wallet (docs/development/flextv-backend.md "2단계"): balance, the web charge as FLEXTV's own checkout
 * does it (tv-ui `CheckoutFlex.tsx` · `FlexPaymentDialog`), and the charge and spend history. The `map*` and `read*`
 * functions are pure and tested in `wallet.test.ts`.
 */

/** FLEXTV's rex product: code 100, 110원 a rex with VAT (`ProductItem` 100, `CheckoutFlex.tsx`). */
export const REX_PRODUCT_CODE = 100;
export const REX_PRODUCT_NAME = "렉스";
export const REX_UNIT_PRICE = 110;
/** FLEXTV's charge presets and the custom amount it accepts (`CheckoutFlex.tsx`). */
export const REX_PRESETS = [100, 300, 500, 1_000, 2_000, 3_000, 4_000, 5_000] as const;
export const REX_MIN = 10;
export const REX_MAX = 100_000_000;

/** FLEXTV's web payment methods Ssumnation offers: Payletter's payment window (카카오페이; 카드 · 휴대폰 for VIP), 무통장. */
export type FlextvPayMethod = "kakaopay" | "creditcard" | "mobile" | "virtualaccount";
/** `paytype` codes of FLEXTV's payment-failure notice (`components/pages/checkout/utils.js`). */
const PAYTYPE_CODE: Record<FlextvPayMethod, number> = { creditcard: 2, virtualaccount: 3, kakaopay: 4, mobile: 5 };

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : null);
const text = (value: unknown) => (typeof value === "string" ? value : "");

/* ── Who may charge ──────────────────────────────────────── */

/**
 * FLEXTV's rules for charging (`server/services/shopping` `prepareShopping`): 본인인증 done and 만 19세 이상. Card and
 * phone go through Payletter for VIP members only (`me.isVip`); others would need Hecto's SDK, not connected yet.
 */
export type PaymentProfile = { verified: boolean; minor: boolean; blocked: boolean; vip: boolean };

export function readPaymentProfile(data: unknown): PaymentProfile | null {
  const profile = isRecord(data) && isRecord(data.profile) ? data.profile : null;
  if (!profile) return null;
  return {
    // `PI` is null until the member's 본인인증 (FLEXTV's `IdentityOnlyLink`).
    verified: profile.PI !== null && profile.PI !== undefined && profile.PI !== false,
    minor: profile.isChild === true,
    // A self-declared foreign member: FLEXTV's checkout sends them away.
    blocked: profile.isCustomForeigner === true,
    vip: profile.isVip === true
  };
}

export async function fetchPaymentProfile(token: string): Promise<PaymentProfile | null> {
  const response = await flextvRequest("/api/my/profile", { token });
  if (response.status === 401) return null;
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV profile answered ${response.status}`);
  return readPaymentProfile(response.data);
}

/** The member's spendable 렉스 (`GET_WALLET_V2`), or null when FLEXTV no longer accepts the token. */
export async function fetchBalance(token: string): Promise<number | null> {
  const response = await flextvRequest("/api/luv/remain", { token });
  if (response.status === 401) return null;
  const amount = isRecord(response.data) ? num(response.data.amount) : null;
  if (response.status !== 200 || amount === null) throw new FlextvUnavailableError(`FLEXTV balance answered ${response.status}`);
  return amount;
}

/** Methods FLEXTV has switched off for now (its 결제 장애 notice). */
export function readBlockedMethods(data: unknown): Set<FlextvPayMethod> {
  const blocked = new Set<FlextvPayMethod>();
  const notices = isRecord(data) && Array.isArray(data.data) ? data.data : [];
  for (const notice of notices) {
    const codes = isRecord(notice) && Array.isArray(notice.paytype) ? notice.paytype.map(Number) : [];
    for (const [method, code] of Object.entries(PAYTYPE_CODE) as [FlextvPayMethod, number][]) if (codes.includes(code)) blocked.add(method);
  }
  return blocked;
}

export async function fetchBlockedMethods(): Promise<Set<FlextvPayMethod>> {
  const response = await flextvRequest("/v2/api/guest/payment-failure");
  return response.status === 200 ? readBlockedMethods(response.data) : new Set();
}

/* ── 무통장 ──────────────────────────────────────────────── */

export type DepositAccount = { bank: string; account: string; holder: string };

/** The account members transfer to (`/api/guest/channeling-switching`: bank_code is the bank's name). */
export function readDepositAccount(data: unknown): DepositAccount | null {
  if (!isRecord(data)) return null;
  const bank = text(data.bank_code);
  const account = text(data.bank_account);
  const holder = text(data.bank_holder_name);
  return bank && account && holder ? { bank, account, holder } : null;
}

export async function fetchDepositAccount(): Promise<DepositAccount | null> {
  const response = await flextvRequest("/api/guest/channeling-switching");
  return response.status === 200 ? readDepositAccount(response.data) : null;
}

export type DepositBonusRule = { amount: number; lexPoint: number };

export function readDepositBonusRules(data: unknown): DepositBonusRule[] {
  const rows = Array.isArray(data) ? data : [];
  return rows
    .flatMap((row) => {
      const amount = isRecord(row) ? num(row.amount) : null;
      const lexPoint = isRecord(row) ? num(row.lexPoint) : null;
      return amount !== null && lexPoint !== null ? [{ amount, lexPoint }] : [];
    })
    .sort((a, b) => b.amount - a.amount);
}

/** Bonus 렉스 FLEXTV adds to a 무통장 charge once the deposit is confirmed (`PaymentDialog.js`: floor(rex × lexPoint%)). */
export function depositBonus(rules: DepositBonusRule[], rex: number): number {
  const rule = rules.find((r) => rex >= r.amount);
  return rule ? Math.floor((rex * rule.lexPoint) / 100) : 0;
}

export async function fetchDepositBonusRules(token: string): Promise<DepositBonusRule[]> {
  const response = await flextvRequest("/api/shoppings/bankbook-point", { token });
  return response.status === 200 ? readDepositBonusRules(response.data) : [];
}

/* ── Starting a charge ───────────────────────────────────── */

export type StartOutcome =
  /** Payletter: the member pays in a window at `payUrl`; FLEXTV credits the 렉스 when Payletter calls it back. */
  | { kind: "PAYMENT_WINDOW"; checkoutId: string; payUrl: string }
  /** 무통장: a request waits for the deposit, which FLEXTV matches and credits. */
  | { kind: "DEPOSIT"; trxNo: string }
  /** FLEXTV refused to start (no 본인인증, under 19, or the provider did not answer): its 500 "Cannot process payment". */
  | { kind: "NOT_ALLOWED" }
  /** FLEXTV's own refusal, e.g. "N원에 대한 대기중인 요청이 있습니다." for a 무통장 request of the same amount. */
  | { kind: "REFUSED"; message: string };

export function mapStart({ status, data }: Pick<FlextvResponse, "status" | "data">, { mobile }: { mobile: boolean }): StartOutcome {
  if (status === 200 && isRecord(data) && data.ok === true) {
    const pg = isRecord(data.pg) && isRecord(data.pg.data) ? data.pg.data : null;
    const payUrl = pg ? text(mobile && pg.mobileUrl ? pg.mobileUrl : pg.url) : "";
    const checkoutId = num(data.checkoutId);
    if (payUrl && isPaymentUrl(payUrl) && checkoutId !== null) return { kind: "PAYMENT_WINDOW", checkoutId: String(checkoutId), payUrl };
    const trxNo = text(data.trxNo);
    if (!pg && trxNo) return { kind: "DEPOSIT", trxNo };
    throw new FlextvUnavailableError("FLEXTV started a payment without a payment window");
  }
  if (status === 500 && data === "Cannot process payment") return { kind: "NOT_ALLOWED" };
  if (status === 400) {
    const message = typeof data === "string" ? data : isRecord(data) && typeof data.message === "string" ? data.message : "";
    return { kind: "REFUSED", message };
  }
  throw new FlextvUnavailableError(`FLEXTV checkout answered ${status}`);
}

/** The browser opens it: https only (never `javascript:`), and a local stand-in of FLEXTV in development. */
const isPaymentUrl = (url: string) => /^https:\/\//.test(url) || (process.env.NODE_ENV !== "production" && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(url));

const pad = (n: number) => String(n).padStart(2, "0");
/** FLEXTV's `methodParams` time (Korea time, `yyyyMMdd` · `HHmmss`, tv-ui `createPaymentTime`). */
export function paymentTime(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 3_600_000);
  return {
    trdDt: `${kst.getUTCFullYear()}${pad(kst.getUTCMonth() + 1)}${pad(kst.getUTCDate())}`,
    trdTm: `${pad(kst.getUTCHours())}${pad(kst.getUTCMinutes())}${pad(kst.getUTCSeconds())}`
  };
}

const osOf = (userAgent: string | null) => (/Android/i.test(userAgent ?? "") ? "android" : /iPhone|iPad|iPod/i.test(userAgent ?? "") ? "ios" : undefined);

/** A charge through Payletter's window (`POST /api/shoppings/buy`, as tv-ui's `getOrderSheet`). VIP card · phone use `ver` 2. */
export async function startWindowPayment(token: string, context: DeviceContext, { rex, method }: { rex: number; method: Exclude<FlextvPayMethod, "virtualaccount"> }) {
  const response = await flextvRequest("/api/shoppings/buy", {
    method: "POST",
    token,
    ...requestFrom(context),
    body: {
      productCode: REX_PRODUCT_CODE,
      productName: REX_PRODUCT_NAME,
      amount: rex,
      price: REX_UNIT_PRICE,
      payMethod: method,
      methodParams: paymentTime(),
      targetId: null,
      payDiv: 1,
      ver: method === "kakaopay" ? 1 : 2,
      os: osOf(context.userAgent)
    }
  });
  return mapStart(response, { mobile: context.device === "MOBILEWEB" });
}

/** A 무통장 request (`POST /api/shoppings/coin`): here `price` is the total, as tv-ui's `VirtualAccountDialog` sends it. */
export async function startDeposit(token: string, context: DeviceContext, { rex, depositor }: { rex: number; depositor: string }) {
  const response = await flextvRequest("/api/shoppings/coin", {
    method: "POST",
    token,
    ...requestFrom(context),
    body: { ver: 1, amount: rex, price: rex * REX_UNIT_PRICE, payMethod: "virtualaccount", methodParams: { name: depositor }, payDiv: 1, os: osOf(context.userAgent) }
  });
  return mapStart(response, { mobile: false });
}

/* ── Completion ──────────────────────────────────────────── */

export type CheckoutState =
  | { kind: "COMPLETED"; rex: number | null; price: number | null; trxNo: string | null }
  | { kind: "FAILED"; message: string | null }
  | { kind: "PENDING" };

/**
 * `GET /api/shoppings/checkouts/:id/status`: `completed` once FLEXTV credited the 렉스; a failure leaves a
 * `paymenstCode` (FLEXTV's spelling). A Payletter payment the member abandoned stays not completed.
 */
export function mapCheckoutStatus({ status, data }: Pick<FlextvResponse, "status" | "data">): CheckoutState {
  if (status === 204) return { kind: "PENDING" };
  if (status !== 200 || !isRecord(data)) throw new FlextvUnavailableError(`FLEXTV checkout status answered ${status}`);
  if (data.completed === true) {
    const checkout = isRecord(data.checkout) ? data.checkout : {};
    const rex = num(checkout.amount);
    const unit = num(checkout.price);
    return { kind: "COMPLETED", rex, price: rex !== null && unit !== null ? rex * unit : null, trxNo: text(checkout.trxNo) || null };
  }
  if (isRecord(data.paymenstCode)) return { kind: "FAILED", message: text(data.paymenstCode.message) || null };
  return { kind: "PENDING" };
}

export async function fetchCheckoutStatus(token: string, checkoutId: string): Promise<CheckoutState> {
  return mapCheckoutStatus(await flextvRequest(`/api/shoppings/checkouts/${encodeURIComponent(checkoutId)}/status`, { token }));
}

/* ── History ─────────────────────────────────────────────── */

/** "YYYY-MM-DD HH:mm:ss" in Korea time; FLEXTV's DB keeps UTC and sends ISO times. */
export function kstStamp(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return value;
  const at = Date.parse(value);
  if (!Number.isFinite(at)) return null;
  return new Date(at + 9 * 3_600_000).toISOString().slice(0, 19).replace("T", " ");
}

export type FlextvPayment = { id: string; at: string; rex: number; price: number; payType: number | null; status: number | null; statusName: string };

/** `GET /api/shoppings/flex/payments` rows (option `all`: paid charges only). */
export function readPayments(data: unknown): { items: FlextvPayment[]; count: number } {
  const rows = isRecord(data) && Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
  const items = rows.flatMap((row): FlextvPayment[] => {
    if (!isRecord(row)) return [];
    const id = num(row.id);
    const at = kstStamp(row.createdAt);
    const rex = num(row.amount);
    if (id === null || !at || rex === null) return [];
    return [{ id: String(id), at, rex, price: num(row.price) ?? 0, payType: num(row.payType), status: num(row.status), statusName: text(row.statusName) }];
  });
  return { items, count: (isRecord(data) ? num(data.count) : null) ?? items.length };
}

export async function fetchPayments(token: string, { offset, limit }: { offset: number; limit: number }) {
  const response = await flextvRequest(`/api/shoppings/flex/payments?offset=${offset}&limit=${limit}&option=all&mobile=false`, { token });
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV payments answered ${response.status}`);
  return readPayments(response.data);
}

export type FlextvSpend = { id: string; at: string; rex: number; targetLoginId: string; targetNick: string; status: number | null };

/**
 * `GET /api/luv/sentluv-list` rows: the member's donations (후원), newest first — no channel, message or type in them.
 * Status 9 is settled; 0 · 1 are still being processed.
 */
export function readSpends(data: unknown): { items: FlextvSpend[]; count: number } {
  const rows = isRecord(data) && Array.isArray(data.data) ? data.data : [];
  const items = rows.flatMap((row): FlextvSpend[] => {
    if (!isRecord(row)) return [];
    const id = num(row.id);
    const at = kstStamp(row.createdAt);
    const rex = num(row.amount);
    if (id === null || !at || rex === null) return [];
    return [{ id: String(id), at, rex, targetLoginId: text(row.targetId), targetNick: text(row.targetnick) || text(row.targetId), status: num(row.status) }];
  });
  return { items, count: (isRecord(data) ? num(data.count) : null) ?? items.length };
}

/** FLEXTV caps a page at 50. */
export async function fetchSpends(token: string, { offset, limit }: { offset: number; limit: number }) {
  const response = await flextvRequest(`/api/luv/sentluv-list?offset=${offset}&limit=${Math.min(limit, 50)}`, { token });
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV donations answered ${response.status}`);
  return readSpends(response.data);
}

/** FLEXTV `payType` → the method a member recognizes (`server/const.js` PAY_TYPE). */
export const PAY_TYPE_LABEL: Record<number, { label: string; emoji: string }> = {
  1: { label: "해외카드", emoji: "💳" },
  2: { label: "신용카드", emoji: "💳" },
  3: { label: "무통장입금", emoji: "🏧" },
  4: { label: "카카오페이", emoji: "K" },
  5: { label: "휴대폰결제", emoji: "📱" },
  12: { label: "내통장결제", emoji: "🏦" },
  6: { label: "간편결제", emoji: "P" },
  13: { label: "App Store", emoji: "" },
  14: { label: "Google Play", emoji: "▶" }
};
