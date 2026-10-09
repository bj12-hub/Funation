import { USE_MOCK } from "@/lib/mock";
import { mockPlatform, type MockPlatformTransaction } from "@/services/platformDonation/mockPlatformStore";
import { checkNow, inRecheckWindow, isPending, listedForOperator, needsOperator, recheckPending, sentByCurrentAccount, settle } from "@/services/platformDonation/pendingCore";
import { PLATFORMS } from "@/services/platformDonation/platformTypes";
import type { AdminActor } from "./adminTypes";
import { recordAudit } from "./auditCore";
import { slotAccountLabel } from "./memberCore";
import { RESOLVE_NOTE, type PendingCheckResult, type PendingDonationRow, type PendingDonationsView, type PendingResolveResult } from "./pendingDonationTypes";

/**
 * 확인 중 후원 API logic (2026-10-08 결정) — called by `/api/admin/platform-donations/*`. Admin app screen
 * `/donations/pending`. A SOOP · FlexTV donation whose platform result is still unknown 24 hours after the request
 * (FN held, platformDonation/pendingCore.ts) is listed here: an operator asks the platform again (다시 확인) or decides
 * 성공 / 실패 with a required memo. Every decision is audited (`PLATFORM_DONATION_RESOLVE`), runs once per console
 * request id, and is refused once the donation is settled. 실패 returns the held FN — not when the account that sent it
 * has withdrawn since: then it is recorded as forfeited (반환 불가(탈퇴)) and nothing is credited.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Admin platform donation API is not connected yet.");
};
const REQUEST_ID = /^[A-Za-z0-9-]{16,64}$/;
const OUTCOME_LABEL = { COMPLETED: "성공", FAILED: "실패" } as const;
const fnText = (n: number) => `${n.toLocaleString("ko-KR")} FN`;
const find = (id: unknown) => (typeof id === "string" ? mockPlatform.transactions.find((t) => t.transactionId === id) : undefined);

function row(t: MockPlatformTransaction): PendingDonationRow {
  const who = slotAccountLabel(t.account ?? null);
  const r = t.resolution;
  return {
    transactionId: t.transactionId,
    platform: t.platform,
    platformLabel: PLATFORMS[t.platform].name,
    creatorName: t.creatorName,
    productLabel: t.productLabel,
    fnAmount: t.fnAmount,
    requestedAt: t.requestedAt,
    memberId: who.memberId,
    memberName: who.name,
    // Same test as the FN return: an account that is not the slot's current one, or the slot while withdrawn.
    memberWithdrawn: !sentByCurrentAccount(t),
    lastCheckAt: t.pending?.lastCheckAt ?? null,
    resolution: r ? { outcome: r.outcome, at: r.at, by: r.by, operator: r.operator, note: r.note, fnReturn: r.fnReturn, externalTransactionId: t.externalTransactionId } : null
  };
}

/** The list. Reading it first re-checks every pending donation still inside its 24 h (lazy, like 후원 내역). */
export async function getPendingDonations(): Promise<PendingDonationsView> {
  assertMock();
  await recheckPending(() => true);
  const now = Date.now();
  const all = mockPlatform.transactions;
  const waiting = all.filter((t) => needsOperator(t, now)).sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
  const resolved = all.filter((t) => listedForOperator(t, now) && t.resolution).sort((a, b) => b.resolution!.at.localeCompare(a.resolution!.at));
  return { waiting: waiting.map(row), resolved: resolved.map(row), checking: all.filter((t) => isPending(t) && inRecheckWindow(t, now)).length };
}

/** For the dashboard's 처리 대기: donations waiting for an operator (no lookup — past 24 h nothing re-checks by itself). */
export const pendingDonationCount = (now = Date.now()) => mockPlatform.transactions.filter((t) => needsOperator(t, now)).length;

/**
 * 다시 확인: asks the platform about a pending donation now (any age). A result settles it as the lazy re-check does;
 * the call is audited with what the platform answered.
 */
export async function checkPendingDonation(admin: AdminActor, input: unknown): Promise<PendingCheckResult> {
  assertMock();
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const t = find(v.transactionId);
  if (!t || !t.pending) return { status: "NOT_FOUND" };
  if (!isPending(t)) return { status: "INVALID", message: "이미 결과가 정해진 후원이에요." };
  const answer = await checkNow(t);
  // Settled while the platform was asked (an operator or a read): report what it is now.
  const outcome = answer === "SETTLED" ? (t.status === "COMPLETED" ? "COMPLETED" : "FAILED") : answer;
  const said = outcome === "UNKNOWN" ? "결과 없음" : outcome === "COMPLETED" ? "완료" : t.resolution?.fnReturn === "FORFEITED" ? "실패 · 반환 불가(탈퇴)" : "실패 · FN 반환";
  recordAudit(admin, "PLATFORM_DONATION_CHECK", `platform-donation:${t.transactionId}`, `${PLATFORMS[t.platform].name} ${t.productLabel} · ${fnText(t.fnAmount)} · 플랫폼 확인: ${said}`);
  return { status: "OK", outcome };
}

/**
 * 성공 / 실패 결정: `{ transactionId, outcome: "COMPLETED" | "FAILED", note, requestId }`. Only for a donation still pending
 * after its 24 h; refused once it is settled. The same console request id with the same donation, outcome and memo answers
 * OK without a second change or log entry; anything else under that id is refused. The checks and the write run in one
 * synchronous step.
 */
export async function resolvePendingDonation(admin: AdminActor, input: unknown): Promise<PendingResolveResult> {
  assertMock();
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  if (typeof v.requestId !== "string" || !REQUEST_ID.test(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const note = typeof v.note === "string" ? v.note.trim() : "";
  const done = mockPlatform.transactions.find((t) => t.resolution?.requestId === v.requestId);
  // A retry is the same donation, outcome and memo; anything else under that id was never decided.
  if (done) {
    const same = done.transactionId === v.transactionId && done.resolution?.outcome === v.outcome && done.resolution?.note === note;
    return same ? { status: "OK" } : { status: "INVALID", message: "잘못된 요청입니다." };
  }
  const t = find(v.transactionId);
  if (!t || !t.pending) return { status: "NOT_FOUND" };
  if (v.outcome !== "COMPLETED" && v.outcome !== "FAILED") return { status: "INVALID", message: "성공 또는 실패를 골라 주세요." };
  if (note.length < RESOLVE_NOTE.min || note.length > RESOLVE_NOTE.max) return { status: "INVALID", message: `처리 메모를 ${RESOLVE_NOTE.min}~${RESOLVE_NOTE.max}자로 입력해 주세요.` };
  if (!isPending(t)) return { status: "INVALID", message: `이미 결과가 정해진 후원이에요 (${t.status === "COMPLETED" ? "완료" : "실패"}).` };
  if (inRecheckWindow(t)) return { status: "INVALID", message: "요청 후 24시간이 지나지 않아 아직 플랫폼 결과를 자동으로 확인하고 있어요." };
  const r = settle(t, { outcome: v.outcome, by: "OPERATOR", operator: admin.nickname, note, requestId: v.requestId });
  const effect = r.outcome === "COMPLETED" ? "보관 FN 사용 처리" : r.fnReturn === "RETURNED" ? "FN 반환" : "반환 불가(탈퇴) · FN 소멸";
  recordAudit(admin, "PLATFORM_DONATION_RESOLVE", `platform-donation:${t.transactionId}`, `${OUTCOME_LABEL[r.outcome]} · ${PLATFORMS[t.platform].name} ${t.productLabel} · ${fnText(t.fnAmount)} · ${effect} · ${note}`);
  return { status: "OK" };
}
