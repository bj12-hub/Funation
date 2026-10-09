import { toDateString } from "@/lib/period";
import { USE_MOCK } from "@/lib/mock";
import { mockAccount } from "@/services/account/mockStore";
import { accountSince, isWithdrawn } from "@/services/account/withdrawalCore";
import { purgeExpired } from "@/services/account/retentionPurge";
import { mockRefunds, type MockRefundRequest } from "@/services/wallet/mockRefundStore";
import { chargeRefundQuote } from "@/services/wallet/refundCore";
import { REFUND_POLICY_LABEL, REFUND_POLICY_SUMMARY, REFUND_TYPE_LABEL, refundAmounts, sameRefund, type RefundAmounts, type RefundQuote } from "@/services/wallet/refundPolicy";
import { findChargeRecord, listAccountChargeRecords, listAccountDonationRecords, listChargeRecords } from "@/services/wallet/walletHistory";
import type { DonationStatus } from "@/services/wallet/walletTypes";
import type { AdminActor } from "./adminTypes";
import { recordAudit } from "./auditCore";
import { activeHold, holdRequestId, pushHold, readHoldInput, recordedHold } from "./holdCore";
import { SAMPLE_MEMBER_ID, slotAccountLabel } from "./memberCore";
import { REFUND_NOTE, type AdminChargeRow, type AdminDonationRow, type AdminRefund, type DonationsView, type PaymentsView, type RefundDecisionResult } from "./paymentTypes";

/**
 * 후원 · 결제 운영 API logic — code-first (called by `/api/admin/*`). Admin app screens `/admin/payments`, `/admin/donations`.
 * Admin only. A refund decision is final and logged; approval takes back the charge's unused paid FN on the server
 * (환불 정책 기본값 · 법무 검토 전, `services/wallet/refundPolicy.ts`) and records the KRW refund with it; paying the
 * KRW out through the payment provider is TBD. The mock has one member with wallet data (the sample member); per-member
 * ledgers are TBD.
 *
 * 2026-10-08 결정: a member's 이용 정지 does not stop their refund requests (nothing here reads it); an operator puts a
 * request that needs a closer look on 보류 instead, which stops 승인 · 거절 until 보류 해제.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Admin payment API is not connected yet.");
};
/**
 * Whose a wallet record is, by the start marker of the account it belongs to: the account holding the slot now, or a
 * withdrawn one a 재가입 moved aside (`…-wN`). A withdrawn account shows its original nickname, marked withdrawn
 * (2026-10-08 결정 — the console shows 탈퇴 with a badge, never "탈퇴한 회원").
 */
const owner = (account: string | null) => {
  const a = slotAccountLabel(account);
  return { memberId: a.memberId, memberName: a.name, memberWithdrawn: a.withdrawn };
};

/**
 * Whether a refund request was filed by the account that holds the mock slot now (and has not withdrawn).
 * The mock reuses one member id after a 재가입, so the account start marker stored with the request decides.
 */
const fromCurrentAccount = (r: MockRefundRequest) => r.accountSince === accountSince() && !isWithdrawn();

/** The 보류 in force on a waiting request (2026-10-08 결정); a decided request has none. */
const holdOf = (r: MockRefundRequest) => (r.status === "REQUESTED" ? activeHold(r.holds) : null);

/**
 * Each waiting request is in one place (2026-10-08 결정): 처리 불가(탈퇴) — filed by an account that has since withdrawn
 * (D4b), never decidable; else 보류 — an operator put it on hold; else 처리 대기 — what an operator can decide now.
 */
type Queue = "WAITING" | "HELD" | "BLOCKED";
const queueOf = (r: MockRefundRequest): Queue => (!fromCurrentAccount(r) ? "BLOCKED" : holdOf(r) ? "HELD" : "WAITING");

/**
 * 처리 대기 (2026-10-08 결정): requests an operator can decide now. 처리 불가(탈퇴) and 보류 requests are left out of the
 * 처리 대기 counts and listed apart; `decideRefund` still refuses both.
 */
export function refundQueue(): { waiting: number; blocked: number; held: number } {
  const open = mockRefunds.requests.filter((r) => r.status === "REQUESTED").map(queueOf);
  return { waiting: open.filter((q) => q === "WAITING").length, blocked: open.filter((q) => q === "BLOCKED").length, held: open.filter((q) => q === "HELD").length };
}

/** Order: 처리 대기, then 보류, then 처리 불가(탈퇴), then decided requests; newest first within each. */
const RANK: Record<Queue, number> = { WAITING: 0, HELD: 1, BLOCKED: 2 };
const queueRank = (r: MockRefundRequest) => (r.status !== "REQUESTED" ? 3 : RANK[queueOf(r)]);

function refunds(): AdminRefund[] {
  return [...mockRefunds.requests]
    .sort((a, b) => queueRank(a) - queueRank(b) || b.requestedAt.localeCompare(a.requestedAt))
    .map((r) => {
      const c = findChargeRecord(r.chargeId);
      const who = slotAccountLabel(r.accountSince);
      return {
        chargeId: r.chargeId,
        // The slot's id belongs to a new account after a 재가입: a withdrawn account's request points to its `…-wN`.
        memberId: r.memberId === SAMPLE_MEMBER_ID ? who.memberId : r.memberId,
        memberName: who.name,
        // Same account test as `fromCurrentAccount`: such a request is shown with a 탈퇴 badge and cannot be decided.
        memberWithdrawn: !fromCurrentAccount(r),
        requestedAt: r.requestedAt,
        reason: r.reason,
        status: r.status,
        decision: r.decision ?? null,
        charge: c ? { chargedAt: c.chargedAt, fnAmount: c.fnAmount, paidAmount: c.paidAmount, methodLabel: c.methodLabel, transactionId: c.transactionId } : null,
        requested: copy(r.quote),
        approved: r.settled ? copy(r.settled) : null,
        // What approval would refund now (FN used since the request lower it); only for requests an operator can decide.
        current: r.status === "REQUESTED" && fromCurrentAccount(r) ? currentQuote(r) : null,
        hold: holdOf(r)
      };
    });
}

const copy = (a: RefundAmounts): RefundAmounts => ({ type: a.type, grossFn: a.grossFn, feeFn: a.feeFn, netFn: a.netFn, refundKrw: a.refundKrw });

/** The refund recomputed now for a waiting request of the current account; the 청약철회 period stays the request's. */
function currentQuote(r: MockRefundRequest): RefundQuote | null {
  const charge = listChargeRecords().find((c) => c.id === r.chargeId);
  return charge && charge.status === "COMPLETED" ? chargeRefundQuote(charge, new Date(r.requestedAt)) : null;
}

const fnText = (n: number) => `${n.toLocaleString("ko-KR")} FN`;
/** "수수료 공제 후 환불 · 회수 5,000 FN · 수수료 500 FN · 환불 4,500 FN · 4,950원" (audit log and approval answers). */
const refundText = (a: RefundAmounts) =>
  `${REFUND_TYPE_LABEL[a.type]} · 회수 ${fnText(a.grossFn)} · 수수료 ${fnText(a.feeFn)} · 환불 ${fnText(a.netFn)} · ${a.refundKrw.toLocaleString("ko-KR")}원`;
const isAmount = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;

export async function getPaymentsView(): Promise<PaymentsView | null> {
  assertMock();
  purgeExpired(); // records past their retention date are not shown (account/retentionPolicy.ts)
  // Every account's charges: a withdrawn account's stay in the console (audit trail) under its own `…-wN` member.
  const charges = listAccountChargeRecords()
    .map(
      (c): AdminChargeRow => ({
        id: c.id,
        chargedAt: c.chargedAt,
        methodLabel: c.methodLabel,
        fnAmount: c.fnAmount,
        paidAmount: c.paidAmount,
        status: c.status,
        transactionId: c.transactionId,
        refund: c.refund ? { status: c.refund.status, requestedAt: c.refund.requestedAt } : null,
        ...owner(c.account)
      })
    )
    .sort((a, b) => b.chargedAt.localeCompare(a.chargedAt));
  return { charges, refunds: refunds(), balance: mockAccount.fnBalance, refundPolicy: { label: REFUND_POLICY_LABEL, summary: REFUND_POLICY_SUMMARY } };
}

/**
 * 환불 승인 (환불 정책 기본값): the refund is recomputed in the same synchronous step as the write — FN the member used
 * since the request lower it — and only the charge's unused paid FN are taken back. The operator approves the amount
 * the console showed (`expectedGrossFn` / `expectedNetFn`); when that is no longer the current one nothing is written
 * and the answer says what it is now. The balance change, its wallet record and the decision happen together. A
 * withdrawn member's request is not decided here: approving it would take the FN from whoever holds the slot now. A
 * request on 보류 is not decided until 보류 해제.
 */
export async function decideRefund(admin: AdminActor, input: unknown): Promise<RefundDecisionResult> {
  assertMock();
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const request = mockRefunds.requests.find((r) => r.chargeId === v.chargeId);
  if (!request) return { status: "NOT_FOUND" };
  if (v.decision !== "APPROVE" && v.decision !== "REJECT") return { status: "INVALID", message: "처리 방법을 골라 주세요." };
  const note = typeof v.note === "string" ? v.note.trim() : "";
  if (note.length < REFUND_NOTE.min || note.length > REFUND_NOTE.max) return { status: "INVALID", message: `처리 메모를 ${REFUND_NOTE.min}~${REFUND_NOTE.max}자로 입력해 주세요.` };
  const wanted = v.decision === "APPROVE" ? "APPROVED" : "REJECTED";
  if (request.status !== "REQUESTED") {
    // Retrying the same decision is harmless; a different one is refused (decisions are final).
    return request.status === wanted ? { status: "OK" } : { status: "INVALID", message: "이미 처리된 환불 요청이에요." };
  }
  if (!fromCurrentAccount(request)) return { status: "INVALID", message: "탈퇴한 회원의 환불 요청이라 승인 · 거절할 수 없어요. (처리 중인 환불이 있으면 탈퇴할 수 없어서, 이전 기록에만 있어요.)" };
  if (holdOf(request)) return { status: "INVALID", message: "보류 중인 환불 요청이라 승인 · 거절할 수 없어요. 보류를 해제한 뒤 처리해 주세요." };
  const charge = listChargeRecords().find((c) => c.id === request.chargeId);
  if (!charge || charge.status !== "COMPLETED") return { status: "INVALID", message: "완료된 충전이 아니에요." };
  const now = new Date();
  let what = `충전 ${fnText(charge.fnAmount)} · 요청 ${refundText(request.quote)}`;
  if (wanted === "APPROVED") {
    if (!isAmount(v.expectedGrossFn) || !isAmount(v.expectedNetFn)) return { status: "INVALID", message: "승인할 환불 금액을 확인해 주세요. 화면을 새로 고친 뒤 다시 승인해 주세요." };
    // Recomputed here; the checks and the write below run in one step (nothing awaits in between).
    const settled = refundAmounts(chargeRefundQuote(charge, new Date(request.requestedAt)));
    if (!settled) return { status: "INVALID", message: "요청 후 이 충전의 FN을 모두 사용해서 지금은 환불할 FN이 없어요. 거절로 처리해 주세요." };
    if (v.expectedGrossFn !== settled.grossFn || v.expectedNetFn !== settled.netFn) {
      return { status: "INVALID", message: `요청 후 FN 사용으로 환불 금액이 바뀌었어요. 지금 기준(${refundText(settled)})으로만 승인할 수 있어요. 확인한 뒤 다시 승인해 주세요.` };
    }
    if (mockAccount.fnBalance < settled.grossFn) return { status: "INVALID", message: "보유 FN이 회수할 FN보다 적어 승인할 수 없어요." };
    mockAccount.fnBalance -= settled.grossFn;
    request.settled = settled;
    // Every balance change leaves a wallet record: the member's FN Wallet lists it as 환불 (−).
    request.debit = { fnAmount: settled.grossFn, at: `${toDateString(now)} ${now.toTimeString().slice(0, 8)}`, by: admin.nickname };
    what = sameRefund(settled, request.quote) ? refundText(settled) : `${refundText(settled)} (요청 때 ${refundText(request.quote)})`;
  }
  request.status = wanted;
  request.decision = { at: now.toISOString(), by: admin.nickname, note };
  recordAudit(admin, wanted === "APPROVED" ? "REFUND_APPROVE" : "REFUND_REJECT", `refund:${request.chargeId}`, `${what} · ${note}`);
  return { status: "OK" };
}

/**
 * 보류 / 보류 해제 (2026-10-08 결정): `{ action: "HOLD" | "RELEASE", note, requestId }` for a waiting refund request of the
 * current account. The memo is required and stays with the operators; the request stays REQUESTED (the member keeps
 * seeing 심사 중), so 보류 해제 leaves it as it was and nothing moves in the wallet. One console request id per action: the
 * same id again answers OK without a second change or log entry (`REFUND_HOLD` / `REFUND_RELEASE`).
 */
export async function holdRefund(admin: AdminActor, input: unknown): Promise<RefundDecisionResult> {
  assertMock();
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const requestId = holdRequestId(v);
  if (!requestId) return { status: "INVALID", message: "잘못된 요청입니다." };
  const done = recordedHold(mockRefunds.requests, requestId);
  if (done) return done.item.chargeId === v.chargeId && done.event.action === v.action ? { status: "OK" } : { status: "INVALID", message: "잘못된 요청입니다." };
  const request = mockRefunds.requests.find((r) => r.chargeId === v.chargeId);
  if (!request) return { status: "NOT_FOUND" };
  const read = readHoldInput(v);
  if ("message" in read) return { status: "INVALID", message: read.message };
  const held = holdOf(request);
  if (read.action === "HOLD") {
    if (request.status !== "REQUESTED") return { status: "INVALID", message: "심사 대기 중인 환불 요청만 보류할 수 있어요." };
    if (!fromCurrentAccount(request)) return { status: "INVALID", message: "탈퇴한 회원의 환불 요청이라 보류할 수 없어요." };
    if (held) return { status: "INVALID", message: "이미 보류 중인 환불 요청이에요." };
  } else if (!held) return { status: "INVALID", message: "보류 중인 환불 요청이 아니에요." };
  pushHold(request, admin, read.action, read.note, requestId);
  recordAudit(admin, read.action === "HOLD" ? "REFUND_HOLD" : "REFUND_RELEASE", `refund:${request.chargeId}`, read.note);
  return { status: "OK" };
}

export async function getDonationsView(input: { status?: unknown } = {}): Promise<DonationsView | null> {
  assertMock();
  purgeExpired();
  // Field by field: the supporter's message and profile settings are not the console's to show.
  const all = listAccountDonationRecords()
    .map((d): AdminDonationRow => ({ id: d.id, donatedAt: d.donatedAt, creatorName: d.creatorName, fnAmount: d.fnAmount, typeLabel: d.typeLabel, status: d.status, ...owner(d.account) }))
    .sort((a, b) => b.donatedAt.localeCompare(a.donatedAt));
  const statuses: DonationStatus[] = ["COMPLETED", "PROCESSING", "FAILED", "REFUNDING", "REFUNDED"];
  const byStatus = Object.fromEntries(statuses.map((s) => [s, { count: 0, fn: 0 }])) as DonationsView["byStatus"];
  const types = new Map<string, { count: number; fn: number }>();
  for (const d of all) {
    byStatus[d.status].count++;
    byStatus[d.status].fn += d.fnAmount;
    if (d.status === "COMPLETED") {
      const t = types.get(d.typeLabel) ?? { count: 0, fn: 0 };
      t.count++;
      t.fn += d.fnAmount;
      types.set(d.typeLabel, t);
    }
  }
  const rows = statuses.includes(input.status as DonationStatus) ? all.filter((d) => d.status === input.status) : all;
  return { rows, byStatus, byType: [...types].map(([typeLabel, t]) => ({ typeLabel, ...t })).sort((a, b) => b.fn - a.fn) };
}
