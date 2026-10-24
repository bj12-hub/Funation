"use server";

import { redirect } from "next/navigation";
import { SAMPLE_MEMBER_ID, isMemberSuspended } from "@/services/admin/memberCore";
import { sessionFromMember, signIn as flextvSignIn } from "@/lib/flextv/auth";
import { FLEXTV_AUTH } from "@/lib/flextv/mode";
import { requestDeviceContext } from "@/lib/flextv/request";
import { USE_MOCK, mockDelay } from "@/lib/mock";
import { safeRedirectPath } from "@/lib/safeRedirect";
import { startSession } from "@/lib/session";
import { mockCredentials } from "@/services/account/mockStore";
import { clearPasswordFailures, isPasswordLocked, recordLogin, recordPasswordFailure, resolveAccount } from "./loginLockCore";

/**
 * Login service contract.
 *
 * With the FLEXTV backend (NEXT_PUBLIC_AUTH_BACKEND=flextv, docs/development/flextv-backend.md) the member signs in
 * with FLEXTV, which counts failures and locks itself. Otherwise this module is the contract the UI depends on, plus a
 * development-only mock that exercises the Figma states locally.
 *
 * This is a Server Action: credentials are checked on the server and, on success,
 * the session cookie is issued there (httpOnly), never in the browser.
 */

export type LoginRequest = {
  identifier: string; // email or ID
  password: string;
  keepSignedIn: boolean;
  /** Where to go after signing in; validated here as a same-site path. */
  next?: string;
};

export type LoginResult =
  | { status: "SUCCESS" }
  | { status: "UNKNOWN_ID" }
  | { status: "WRONG_PASSWORD" }
  | { status: "LOCKED" }
  /** FLEXTV only: 20 wrong passwords within 10 minutes — FLEXTV refuses for 10 minutes (no reset needed). */
  | { status: "TOO_MANY_ATTEMPTS" }
  | { status: "SUSPENDED" };

export async function login(request: LoginRequest): Promise<LoginResult> {
  if (FLEXTV_AUTH) return flextvLogin(request);
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

/* ── FLEXTV (docs/development/flextv-backend.md) ────────────
 * The identifier is the member's FLEXTV 아이디. FLEXTV counts wrong passwords itself (20 within 10 minutes → 10 minutes
 * refused) and answers a 휴면 · 정지 · 탈퇴 member like an unknown 아이디; a blocked member or IP is SUSPENDED.
 * Any other answer (FLEXTV down, no tokens) throws, which the form shows as a temporary error.
 */
async function flextvLogin({ identifier, password, keepSignedIn }: LoginRequest): Promise<LoginResult> {
  if (typeof identifier !== "string" || typeof password !== "string") return { status: "UNKNOWN_ID" };
  const loginId = identifier.trim();
  if (!loginId || loginId.length > 64 || !password || password.length > 64) return { status: "UNKNOWN_ID" };
  const outcome = await flextvSignIn({ loginId, password, keepSignedIn: keepSignedIn === true }, await requestDeviceContext());
  switch (outcome.kind) {
    case "OK": {
      const session = sessionFromMember(outcome.member);
      if (!session) return { status: "SUSPENDED" };
      await startSession({ keepSignedIn: keepSignedIn === true, tokens: outcome.tokens, session });
      return { status: "SUCCESS" };
    }
    case "WRONG_PASSWORD":
      return { status: "WRONG_PASSWORD" };
    case "TOO_MANY_ATTEMPTS":
      return { status: "TOO_MANY_ATTEMPTS" };
    case "BLOCKED":
      return { status: "SUSPENDED" };
    default:
      // NOT_FOUND; NEW_MEMBER only answers a social sign-in.
      return { status: "UNKNOWN_ID" };
  }
}

/* ── Development mock ───────────────────────────────────────
 * identifier "unknown"            → UNKNOWN_ID (also every identifier once the sample account withdrew)
 * password   mockCredentials.password (initially "password") → SUCCESS
 * any other password              → WRONG_PASSWORD, LOCKED after 5 failures of the account (./loginLockCore.ts)
 */

/** Figma 718:335 copy says "6개월 이상"; the real rule is the backend's (TBD). */
const PASSWORD_MAX_AGE_DAYS = 180;

function isPasswordOld() {
  return Date.now() - new Date(mockCredentials.changedAt).getTime() > PASSWORD_MAX_AGE_DAYS * 86_400_000;
}
async function devMockLogin({ identifier, password }: LoginRequest): Promise<LoginResult> {
  await mockDelay();

  // Counted per account, whatever spelling of the identifier was typed; nothing awaits from here on.
  const account = resolveAccount(identifier);
  if (!account) return { status: "UNKNOWN_ID" };
  if (isPasswordLocked(account)) return { status: "LOCKED" };
  if (typeof password === "string" && password === mockCredentials.password) {
    clearPasswordFailures(account);
    // 이용 정지 (관리자 콘솔): the sample member cannot sign in while suspended.
    if (isMemberSuspended(SAMPLE_MEMBER_ID)) return { status: "SUSPENDED" };
    recordLogin(account);
    return { status: "SUCCESS" };
  }
  return recordPasswordFailure(account) ? { status: "LOCKED" } : { status: "WRONG_PASSWORD" };
}
