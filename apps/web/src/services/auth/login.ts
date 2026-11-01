"use server";

import { redirect } from "next/navigation";
import { SAMPLE_MEMBER_ID, isMemberSuspended } from "@/services/admin/memberCore";
import { USE_MOCK, mockDelay } from "@/lib/mock";
import { safeRedirectPath } from "@/lib/safeRedirect";
import { startSession } from "@/lib/session";
import { mockCredentials } from "@/services/account/mockStore";
import { applyDueWithdrawal } from "@/services/account/withdrawalApply";
import { withdrawalRequestOf, withdrawalStore } from "@/services/account/withdrawalCore";
import { clearPasswordFailures, isPasswordLocked, recordLogin, recordPasswordFailure, resolveAccount } from "./loginLockCore";

/**
 * Login service contract.
 *
 * The backend is not decided yet (see docs/product/open-decisions.md), so this
 * module only defines the contract the UI depends on, plus a development-only
 * mock. Login attempts, failure counting and lockout MUST be enforced by the
 * server; the mock only exists to exercise the Figma states locally.
 *
 * This is a Server Action: credentials are checked on the server and, on success,
 * the session cookie is issued there (httpOnly), never in the browser.
 *
 * 회원탈퇴 유예 (탈퇴 철회) — 2026-11-01 사용자 결정 (FLEXTV 조건 기본안): during the 30 days of a 탈퇴 신청 the right
 * password answers WITHDRAWAL_PENDING (no session) with the date it takes effect; the same sign-in with
 * `cancelWithdrawal` removes the request — the account is exactly as it was — and signs in as usual. Once it is due the
 * account has withdrawn (UNKNOWN_ID).
 */

export type LoginRequest = {
  identifier: string; // email or ID
  password: string;
  keepSignedIn: boolean;
  /** Where to go after signing in; validated here as a same-site path. */
  next?: string;
  /** 탈퇴 철회: with the right password, cancels the account's waiting 탈퇴 신청 and signs in. */
  cancelWithdrawal?: boolean;
};

export type LoginResult =
  | { status: "SUCCESS" }
  | { status: "UNKNOWN_ID" }
  | { status: "WRONG_PASSWORD" }
  | { status: "LOCKED" }
  | { status: "SUSPENDED" }
  /** The account's 탈퇴 신청 takes effect at `effectiveAt` (ISO); sign in again with `cancelWithdrawal` to cancel it. */
  | { status: "WITHDRAWAL_PENDING"; effectiveAt: string };

export async function login(request: LoginRequest): Promise<LoginResult> {
  if (!USE_MOCK) throw new Error("Login API is not connected yet.");
  const result = await devMockLogin(request);
  if (result.status !== "SUCCESS") return result;
  await startSession({ keepSignedIn: request.keepSignedIn });
  // Figma 718:335: an old password gets the change prompt first. Redirecting from the action keeps the
  // prompt from being skipped by /login, which sends signed-in members on to `next`.
  if (isPasswordOld()) {
    redirect(`/login/password-change?next=${encodeURIComponent(safeRedirectPath(request.next))}`);
  }
  return result;
}

/* ── Development mock ───────────────────────────────────────
 * identifier "unknown"            → UNKNOWN_ID (also every identifier once the sample account withdrew)
 * password   mockCredentials.password (initially "password") → SUCCESS (WITHDRAWAL_PENDING while a 탈퇴 신청 waits)
 * any other password              → WRONG_PASSWORD, LOCKED after 5 failures of the account (./loginLockCore.ts)
 */

/** Figma 718:335 copy says "6개월 이상"; the real rule is the backend's (TBD). */
const PASSWORD_MAX_AGE_DAYS = 180;

function isPasswordOld() {
  return Date.now() - new Date(mockCredentials.changedAt).getTime() > PASSWORD_MAX_AGE_DAYS * 86_400_000;
}
async function devMockLogin({ identifier, password, cancelWithdrawal }: LoginRequest): Promise<LoginResult> {
  // A 탈퇴 신청 whose 30 days are over takes effect before the account is looked up (./withdrawalApply.ts).
  applyDueWithdrawal();
  await mockDelay();

  // Counted per account, whatever spelling of the identifier was typed; nothing awaits from here on. A request that
  // fell due during the delay already counts as withdrawn here (UNKNOWN_ID).
  const account = resolveAccount(identifier);
  if (!account) return { status: "UNKNOWN_ID" };
  if (isPasswordLocked(account)) return { status: "LOCKED" };
  if (typeof password === "string" && password === mockCredentials.password) {
    clearPasswordFailures(account);
    // 탈퇴 신청 waiting for its date: no session. 탈퇴 철회 removes it — nothing else changed during the 30 days, so the
    // account is exactly as it was — and the sign-in goes on as usual (a suspension still applies).
    const request = withdrawalRequestOf();
    if (request) {
      if (cancelWithdrawal !== true) return { status: "WITHDRAWAL_PENDING", effectiveAt: request.effectiveAt };
      withdrawalStore().request = null;
    }
    // 이용 정지 (관리자 콘솔): the sample member cannot sign in while suspended.
    if (isMemberSuspended(SAMPLE_MEMBER_ID)) return { status: "SUSPENDED" };
    recordLogin(account);
    return { status: "SUCCESS" };
  }
  return recordPasswordFailure(account) ? { status: "LOCKED" } : { status: "WRONG_PASSWORD" };
}
