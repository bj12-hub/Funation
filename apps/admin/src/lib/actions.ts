"use server";

import { redirect } from "next/navigation";
import type { ActionResult, PendingCheckResult } from "@/types/adminApi";
import { endOperatorSession, getOperator, startMockOperatorSession } from "./session";
import { SiteApiError, siteSend } from "./siteApi";

/**
 * Admin app Server Actions. Each re-checks the operator session, then forwards to the site's admin API,
 * which validates, applies and audits the change. Inputs are passed through as-is (the site validates).
 */

async function send<R extends { status: string } = ActionResult>(method: "POST" | "PUT" | "DELETE", path: string, body?: unknown): Promise<R | Exclude<ActionResult, { status: "OK" }>> {
  const operator = await getOperator();
  if (!operator) return { status: "UNAUTHORIZED" };
  try {
    return await siteSend<R>(operator, method, path, body);
  } catch (e) {
    return e instanceof SiteApiError ? { status: e.code } : { status: "UNAVAILABLE" };
  }
}
const seg = (v: unknown) => encodeURIComponent(String(v ?? ""));
const obj = (v: unknown) => (typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {});

export async function signInMockOperator(): Promise<void> {
  const operator = await startMockOperatorSession();
  // Best effort: the sign-in is recorded in the site's audit log when the site is reachable.
  await siteSend(operator, "POST", "/audit/session", { event: "SIGN_IN" }).catch(() => undefined);
  redirect("/");
}

export async function signOutOperator(): Promise<void> {
  const operator = await getOperator();
  if (operator) await siteSend(operator, "POST", "/audit/session", { event: "SIGN_OUT" }).catch(() => undefined);
  await endOperatorSession();
  redirect("/login");
}

export async function suspendMember(input: unknown) {
  const v = obj(input);
  return send("POST", `/members/${seg(v.id)}/suspend`, { days: v.days, reason: v.reason, requestId: v.requestId });
}

export async function restoreMember(input: unknown) {
  const v = obj(input);
  return send("POST", `/members/${seg(v.id)}/restore`, { reason: v.reason });
}

/**
 * 남은 FN 정리 of a 영구 정지 member: a memo, one `requestId` per intended 정리, and the totals the operator saw (the site
 * refuses them if they changed).
 */
export async function settleMemberFn(input: unknown) {
  const v = obj(input);
  return send("POST", `/members/${seg(v.id)}/fn-settlement`, {
    note: v.note,
    requestId: v.requestId,
    expectedGrossFn: v.expectedGrossFn,
    expectedNetFn: v.expectedNetFn,
    expectedRefundKrw: v.expectedRefundKrw,
    expectedForfeitFn: v.expectedForfeitFn
  });
}

/** 승인 sends the amount the operator saw (`expectedGrossFn` / `expectedNetFn`); the site refuses it if it changed. */
export async function decideRefund(input: unknown) {
  const v = obj(input);
  return send("POST", `/refunds/${seg(v.chargeId)}`, { decision: v.decision, note: v.note, expectedGrossFn: v.expectedGrossFn, expectedNetFn: v.expectedNetFn });
}

export async function decideSettlement(input: unknown) {
  const v = obj(input);
  return send("POST", `/settlements/${seg(v.id)}`, { decision: v.decision, note: v.note });
}

/** 지급 완료: one `requestId` per intended payment, so a retry is recorded once. */
export async function paySettlement(input: unknown) {
  const v = obj(input);
  return send("POST", `/settlements/${seg(v.id)}/pay`, { reference: v.reference, requestId: v.requestId });
}

/** 보류 / 보류 해제 of a settlement request: `action` HOLD | RELEASE, a memo, one `requestId` per action. */
export async function holdSettlement(input: unknown) {
  const v = obj(input);
  return send("POST", `/settlements/${seg(v.id)}/hold`, { action: v.action, note: v.note, requestId: v.requestId });
}

/** 보류 / 보류 해제 of a charge refund request: `action` HOLD | RELEASE, a memo, one `requestId` per action. */
export async function holdRefund(input: unknown) {
  const v = obj(input);
  return send("POST", `/refunds/${seg(v.chargeId)}/hold`, { action: v.action, note: v.note, requestId: v.requestId });
}

export async function saveNotice(input: unknown) {
  return send("POST", "/content/notices", obj(input));
}

export async function deleteNotice(id: unknown) {
  return send("DELETE", `/content/notices/${seg(id)}`);
}

export async function saveFaq(input: unknown) {
  return send("POST", "/content/faqs", obj(input));
}

export async function deleteFaq(id: unknown) {
  return send("DELETE", `/content/faqs/${seg(id)}`);
}

export async function decideReport(input: unknown) {
  const v = obj(input);
  return send("POST", `/reports/${seg(v.id)}`, { action: v.action, note: v.note });
}

/** 확인 중 후원 › 다시 확인: the site asks the platform now and answers what it said (`outcome`). */
export async function checkPendingDonation(transactionId: unknown): Promise<PendingCheckResult> {
  return send<PendingCheckResult>("POST", `/platform-donations/${seg(transactionId)}/check`);
}

/** 확인 중 후원 › 성공 / 실패: `outcome` COMPLETED | FAILED, a memo, one `requestId` per intended decision. */
export async function resolvePendingDonation(input: unknown) {
  const v = obj(input);
  return send("POST", `/platform-donations/${seg(v.transactionId)}/resolve`, { outcome: v.outcome, note: v.note, requestId: v.requestId });
}

/** 이벤트 › 보상 설정: `{ kind: "FREE_FN", amountFn }` or `{ kind: "DRAW", winners, prize }`. */
export async function saveEventReward(input: unknown) {
  const v = obj(input);
  return send("POST", `/events/${seg(v.id)}/reward`, { kind: v.kind, amountFn: v.amountFn, winners: v.winners, prize: v.prize });
}

/** 이벤트 › 보상 지급 or 당첨자 추첨 (by the reward's kind), once per event: one `requestId` per intended action. */
export async function settleEventReward(input: unknown) {
  const v = obj(input);
  return send("POST", `/events/${seg(v.id)}/${v.kind === "DRAW" ? "draw" : "pay"}`, { requestId: v.requestId });
}

export async function checkPlatform(platform: unknown) {
  return send("POST", `/platforms/${seg(platform)}/check`);
}

export async function saveSiteBanner(input: unknown) {
  return send("PUT", "/system/banner", obj(input));
}
