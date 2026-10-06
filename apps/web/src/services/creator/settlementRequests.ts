"use server";

import { randomUUID } from "node:crypto";
import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { mockAccount } from "@/services/account/mockStore";
import { MOCK_SETTLEMENT_POLICY, mockSettlement, toHistoryItem } from "./mockSettlementStore";
import type { QuoteResult, RequestResult, SaveAutoResult, SettlementApplyView, SettlementGate, SettlementQuote } from "./settlementTypes";

/**
 * 정산 신청 — Figma 458:4 · 466:2 · 469:195 · 469:2 · 475:2 · 473:2 · 477:2 · 463:2.
 *
 * Financial rules: the server owns the available balance, the fee breakdown and the net amount;
 * the browser only shows them. A request carries an Idempotency-Key so a retried or double-clicked
 * submit returns the first result instead of creating a second request. Policy numbers (minimum,
 * fee rates, FN→KRW) are Figma samples in MOCK_SETTLEMENT_POLICY and remain TBD, as do the request
 * window (매월 1일 10:00 ~ 10일 23:50 in 466:2), payout schedule, approval workflow and tax handling.
 *
 * Gate, after the session: a 정산 자료 registration (NOT_REGISTERED), then 본인인증 (IDENTITY_REQUIRED,
 * 2026-10-06 결정 "필수로 막기" — the 마이페이지 verification). The checklist's 서류 심사 and 정산 계좌 steps
 * are not separate checks: the mock approves documents on submit (review workflow TBD) and every
 * registration carries the payout account.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Settlement API is not connected yet.");
};

/** 마이페이지 본인인증 done (mockAccount.identity, the same flag the 정산 준비 체크리스트 shows). */
const identityVerified = () => mockAccount.identity !== null;

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function quoteFor(amountFn: number): SettlementQuote {
  const p = MOCK_SETTLEMENT_POLICY;
  // Rounding rule is TBD; half-up matches the Figma sample rows (478:2).
  const paymentFeeFn = Math.round(amountFn * p.paymentFeeRate);
  const serviceFeeFn = Math.round(amountFn * p.serviceFeeRate);
  const totalFeeFn = paymentFeeFn + serviceFeeFn;
  return {
    amountFn,
    paymentFeeRate: p.paymentFeeRate,
    paymentFeeFn,
    serviceFeeRate: p.serviceFeeRate,
    serviceFeeFn,
    totalFeeFn,
    netKrw: (amountFn - totalFeeFn) * p.krwPerFn
  };
}

function checkAmount(amount: unknown): { ok: true; amountFn: number } | { ok: false; message: string } {
  if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount <= 0) return { ok: false, message: "정산 신청 FN을 숫자로 입력해 주세요." };
  if (amount > mockSettlement.availableFn) return { ok: false, message: "신청 가능 FN보다 많이 신청할 수 없어요." };
  const min = MOCK_SETTLEMENT_POLICY.minFn;
  if (amount < min) return { ok: false, message: `${min.toLocaleString("ko-KR")} FN 이상 정산신청 가능합니다.` };
  return { ok: true, amountFn: amount };
}

export async function getSettlementApplyView(): Promise<SettlementApplyView | "UNAUTHORIZED" | SettlementGate> {
  assertMock();
  if (!(await getCreatorSession())) return "UNAUTHORIZED";
  const reg = mockSettlement.registration;
  if (!reg) return "NOT_REGISTERED";
  if (!identityVerified()) return "IDENTITY_REQUIRED";
  await mockDelay(250);

  const requests = mockSettlement.requests;
  const now = new Date();
  const monthly = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 7 + i, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const krw = requests.filter((r) => r.status === "APPROVED" && r.requestedAt.startsWith(month)).reduce((sum, r) => sum + r.netKrw, 0);
    return { month, krw };
  });

  return {
    availableFn: mockSettlement.availableFn,
    minFn: MOCK_SETTLEMENT_POLICY.minFn,
    code: reg.code,
    registrant: reg.registrant,
    holder: reg.holder,
    bankName: reg.bankName,
    accountMasked: reg.accountMasked,
    autoSettlement: mockSettlement.autoSettlement,
    hasPending: requests.some((r) => r.status === "PENDING"),
    monthly,
    recent: requests.slice(0, 5).map(toHistoryItem)
  };
}

/** Fee breakdown for 473:2. Validates the amount against the server balance and policy. */
export async function quoteSettlement(amount: unknown): Promise<QuoteResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  if (!mockSettlement.registration) return { status: "NOT_REGISTERED" };
  if (!identityVerified()) return { status: "IDENTITY_REQUIRED" };
  const check = checkAmount(amount);
  if (!check.ok) return { status: "INVALID", message: check.message };
  await mockDelay(250);
  return { status: "OK", quote: quoteFor(check.amountFn) };
}

/**
 * Creates a settlement request (473:2 확인). Recomputes the quote, deducts the balance and records a
 * PENDING request with a copy of the current (masked) registration — 466:2: a request is paid with
 * the 정산 정보 at request time. The same Idempotency-Key always returns the original request.
 */
export async function requestSettlement(input: unknown): Promise<RequestResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const registration = mockSettlement.registration;
  if (!registration) return { status: "NOT_REGISTERED" };
  // Before the key lookup too: a retried key gets no request back while 본인인증 is missing.
  if (!identityVerified()) return { status: "IDENTITY_REQUIRED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as { amountFn?: unknown; idempotencyKey?: unknown };
  const key = v.idempotencyKey;
  if (typeof key !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(key)) return { status: "INVALID", message: "잘못된 요청입니다. 다시 시도해 주세요." };

  const existing = mockSettlement.idempotency[key];
  if (existing) {
    const r = mockSettlement.requests.find((x) => x.id === existing);
    // Same key, different amount: a client bug or tampering — never reinterpret the first request.
    if (r && r.amountFn !== v.amountFn) return { status: "CONFLICT" };
    if (r) return { status: "REQUESTED", requestId: r.id, quote: quoteFor(r.amountFn) };
  }

  const check = checkAmount(v.amountFn);
  if (!check.ok) return { status: "INVALID", message: check.message };
  // Reserve the key before the (simulated) async work so a concurrent retry cannot slip through.
  // Random id: two requests in the same millisecond must never share one (decisions look up by id).
  const now = new Date();
  const id = `st-${randomUUID()}`;
  mockSettlement.idempotency[key] = id;
  const quote = quoteFor(check.amountFn);
  mockSettlement.availableFn -= check.amountFn;
  // Period = previous month and payout = end of this month, following the 466:2 copy (schedule TBD).
  const periodFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const periodTo = new Date(now.getFullYear(), now.getMonth(), 0);
  const payout = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  mockSettlement.requests.unshift({
    id,
    status: "PENDING",
    requestedAt: ymd(now),
    periodFrom: ymd(periodFrom),
    periodTo: ymd(periodTo),
    amountFn: quote.amountFn,
    feeFn: quote.totalFeeFn,
    netKrw: quote.netKrw,
    payoutDate: ymd(payout),
    // Taken in the same synchronous step as the registration and 본인인증 checks above (no `await` in between).
    registrationAtRequest: { ...registration }
  });
  await mockDelay(600);
  // TODO: the backend writes the request, the balance hold and an audit record in one transaction.
  return { status: "REQUESTED", requestId: id, quote };
}

/**
 * 자동 정산 신청 ON/OFF (458:85). Takes effect from next month per 466:2 copy (TBD). Same gate as a
 * request. No job creates automatic requests yet; when one exists it must re-check this gate (and the
 * amount rules) for every request it makes, not trust the stored flag.
 */
export async function setAutoSettlement(on: unknown): Promise<SaveAutoResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  // Simulated latency first: from the gate below to the write there is no `await`.
  await mockDelay(300);
  if (!mockSettlement.registration) return { status: "NOT_REGISTERED" };
  if (!identityVerified()) return { status: "IDENTITY_REQUIRED" };
  if (typeof on !== "boolean") return { status: "INVALID" };
  mockSettlement.autoSettlement = on;
  return { status: "SAVED", on };
}
