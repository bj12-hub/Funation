import { cookies } from "next/headers";
import { USE_MOCK } from "@/lib/mock";
import { mockAccount, mockSessionState } from "@/services/account/mockStore";
import { isMemberSuspended } from "@/services/admin/memberCore";
import type { Role } from "@/types/role";

/**
 * Server-side session access (Server Components, Server Actions and route handlers only).
 *
 * The real backend and token format are not decided yet (docs/product/open-decisions.md).
 * In mock mode the cookie holds an opaque mock token that resolves to the Figma sample member.
 * The cookie is httpOnly so client code can neither read nor forge it; the backend must still
 * validate the session on every request, and frontend checks are for UX only.
 */

export const SESSION_COOKIE = "funation_session";

/** "로그인 유지" keeps the session for 30 days; otherwise it ends with the browser session. */
const KEEP_SIGNED_IN_SECONDS = 60 * 60 * 24 * 30;

const MOCK_TOKEN = "mock-session-hongGD123";
/** A separate mock operator (not the sample member) for the admin console. How Admin is granted is TBD. */
const MOCK_ADMIN_TOKEN = "mock-session-admin";
const MOCK_ADMIN = { userId: "adm-operator", nickname: "운영자", funationId: "operator", avatarUrl: null, roles: ["ADMIN"] as Role[] };

export type Session = {
  userId: string;
  nickname: string;
  funationId: string;
  avatarUrl: string | null;
  /** Server-resolved roles. Never taken from the client. */
  roles: Role[];
};

/** The Figma sample member (홍길동) runs a channel, so the mock grants both roles. */
const DEFAULT_MOCK_ROLES: Role[] = ["SUPPORTER", "CREATOR"];

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  // TODO: validate the token with the backend once it exists.
  // A suspended member is treated as signed out on every request (the backend must enforce this too).
  if (USE_MOCK && token === MOCK_TOKEN && !mockSessionState.revoked && !isMemberSuspended(MOCK_USER_ID)) {
    // Display fields follow the (editable) mock account.
    const { nickname, funationId, avatarUrl } = mockAccount;
    return { userId: MOCK_USER_ID, nickname, funationId, avatarUrl, roles: [...(mockSessionState.roles ?? DEFAULT_MOCK_ROLES)] };
  }
  if (USE_MOCK && token === MOCK_ADMIN_TOKEN) return { ...MOCK_ADMIN, roles: [...MOCK_ADMIN.roles] };
  return null;
}

export const hasRole = (session: Session | null, role: Role): boolean => !!session && session.roles.includes(role);

/**
 * Session of a member with the Creator role, or `null`. Every creator-studio read and Server Action
 * uses this instead of `getSession()`, so a signed-in supporter cannot call creator APIs directly.
 * TBD: how the Creator role is granted (application / approval / platform verification).
 */
export async function getCreatorSession(): Promise<Session | null> {
  const session = await getSession();
  return hasRole(session, "CREATOR") ? session : null;
}

/** Session of a member with the Admin role, or `null`. Every admin read and Server Action uses this. */
export async function getAdminSession(): Promise<Session | null> {
  const session = await getSession();
  return hasRole(session, "ADMIN") ? session : null;
}

/** Development only: signs in as the mock operator (replaces any member session). */
export async function startMockAdminSession() {
  if (!USE_MOCK) throw new Error("Admin sign-in is not connected yet.");
  (await cookies()).set(SESSION_COOKIE, MOCK_ADMIN_TOKEN, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
}

/** Issues the session cookie after the credentials were accepted. */
export async function startSession({ keepSignedIn }: { keepSignedIn: boolean }) {
  if (!USE_MOCK) throw new Error("Session API is not connected yet.");
  mockSessionState.revoked = false;
  (await cookies()).set(SESSION_COOKIE, MOCK_TOKEN, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(keepSignedIn ? { maxAge: KEEP_SIGNED_IN_SECONDS } : {})
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * Invalidates the current session on the server without touching the cookie, so the page that
 * called the Server Action is not re-rendered immediately (the success modal stays visible).
 * The next request is treated as signed out.
 */
export async function revokeSession() {
  // TODO: revoke on the backend once it exists.
  if (USE_MOCK) mockSessionState.revoked = true;
}

const MOCK_USER_ID = "u-hongGD123";
