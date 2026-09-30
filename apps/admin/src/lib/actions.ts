"use server";

import { redirect } from "next/navigation";
import type { ActionResult } from "@/types/adminApi";
import { endOperatorSession, getOperator, startMockOperatorSession } from "./session";
import { SiteApiError, siteSend } from "./siteApi";

/**
 * Admin app Server Actions. Each re-checks the operator session, then forwards to the site's admin API,
 * which validates, applies and audits the change. Inputs are passed through as-is (the site validates).
 */

async function send(method: "POST" | "PUT" | "DELETE", path: string, body?: unknown): Promise<ActionResult> {
  const operator = await getOperator();
  if (!operator) return { status: "UNAUTHORIZED" };
  try {
    return await siteSend<ActionResult>(operator, method, path, body);
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

export async function decideRefund(input: unknown) {
  const v = obj(input);
  return send("POST", `/refunds/${seg(v.chargeId)}`, { decision: v.decision, note: v.note });
}

export async function decideSettlement(input: unknown) {
  const v = obj(input);
  return send("POST", `/settlements/${seg(v.id)}`, { decision: v.decision, note: v.note });
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

export async function checkPlatform(platform: unknown) {
  return send("POST", `/platforms/${seg(platform)}/check`);
}

export async function saveSiteBanner(input: unknown) {
  return send("PUT", "/system/banner", obj(input));
}
