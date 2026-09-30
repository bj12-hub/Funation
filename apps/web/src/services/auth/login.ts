"use server";

import { redirect } from "next/navigation";
import { SAMPLE_MEMBER_ID, isMemberSuspended } from "@/services/admin/memberCore";
import { USE_MOCK, mockDelay } from "@/lib/mock";
import { safeRedirectPath } from "@/lib/safeRedirect";
import { startSession } from "@/lib/session";
import { mockCredentials } from "@/services/account/mockStore";

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
  | { status: "SUSPENDED" };

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
 * identifier "unknown"            → UNKNOWN_ID
 * password   mockCredentials.password (initially "password") → SUCCESS
 * any other password              → WRONG_PASSWORD, LOCKED after 5 failures
 */
const MAX_FAILURES = 5;

/** Figma 718:335 copy says "6개월 이상"; the real rule is the backend's (TBD). */
const PASSWORD_MAX_AGE_DAYS = 180;

function isPasswordOld() {
  return Date.now() - new Date(mockCredentials.changedAt).getTime() > PASSWORD_MAX_AGE_DAYS * 86_400_000;
}
const failures = new Map<string, number>();

async function devMockLogin({ identifier, password }: LoginRequest): Promise<LoginResult> {
  await mockDelay();

  if ((failures.get(identifier) ?? 0) >= MAX_FAILURES) return { status: "LOCKED" };
  if (identifier === "unknown") return { status: "UNKNOWN_ID" };
  if (password === mockCredentials.password) {
    failures.delete(identifier);
    // 이용 정지 (관리자 콘솔): the sample member cannot sign in while suspended.
    if (isMemberSuspended(SAMPLE_MEMBER_ID)) return { status: "SUSPENDED" };
    return { status: "SUCCESS" };
  }

  const count = (failures.get(identifier) ?? 0) + 1;
  failures.set(identifier, count);
  return count >= MAX_FAILURES ? { status: "LOCKED" } : { status: "WRONG_PASSWORD" };
}
