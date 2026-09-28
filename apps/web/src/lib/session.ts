import { cookies } from "next/headers";
import { USE_MOCK } from "@/lib/mock";

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

export type Session = {
  userId: string;
  nickname: string;
  funationId: string;
  avatarUrl: string | null;
};

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  // TODO: validate the token with the backend once it exists.
  if (USE_MOCK && token === MOCK_TOKEN) return MOCK_SESSION;
  return null;
}

/** Issues the session cookie after the credentials were accepted. */
export async function startSession({ keepSignedIn }: { keepSignedIn: boolean }) {
  if (!USE_MOCK) throw new Error("Session API is not connected yet.");
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

const MOCK_SESSION: Session = {
  userId: "u-hongGD123",
  nickname: "홍길동",
  funationId: "hongGD123",
  avatarUrl: "/mock/account/avatar.png"
};
