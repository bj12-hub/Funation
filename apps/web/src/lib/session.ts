import { cookies } from "next/headers";
import { fetchMyProfile, sessionFromMember } from "@/lib/flextv/auth";
import { FLEXTV_AUTH } from "@/lib/flextv/mode";
import { ACCESS_COOKIE, clearSessionCookieWrites, sessionCookieWrites, type CookieWrite, type FlextvTokens } from "@/lib/flextv/tokens";
import { USE_MOCK } from "@/lib/mock";
import { mockAccount, mockSessionState } from "@/services/account/mockStore";
import { isWithdrawn } from "@/services/account/withdrawalCore";
import { isMemberSuspended } from "@/services/admin/memberCore";
import type { Role } from "@/types/role";

/**
 * Server-side session access (Server Components, Server Actions and route handlers only).
 *
 * With the FLEXTV backend (FLEXTV_AUTH, docs/development/flextv-backend.md) the cookie holds the member's FLEXTV access
 * token and the member is FLEXTV's: every request asks FLEXTV who the token belongs to (kept for a few seconds per
 * server, so one page does not ask several times). The middleware renews the token before it expires.
 * In mock mode the cookie holds an opaque mock token that resolves to the Figma sample member.
 * The cookie is httpOnly so client code can neither read nor forge it; frontend checks are for UX only.
 */

/** The same cookie as `ACCESS_COOKIE` (lib/flextv/tokens.ts), which the edge middleware reads without next/headers. */
export const SESSION_COOKIE = ACCESS_COOKIE;

/** "로그인 유지" keeps the session for 30 days; otherwise it ends with the browser session. */
const KEEP_SIGNED_IN_SECONDS = 60 * 60 * 24 * 30;

const MOCK_TOKEN = "mock-session-hongGD123";

export type Session = {
  userId: string;
  nickname: string;
  ssumnationId: string;
  avatarUrl: string | null;
  /** Server-resolved roles. Never taken from the client. */
  roles: Role[];
};

/** The Figma sample member (홍길동) runs a channel, so the mock grants both roles. */
const DEFAULT_MOCK_ROLES: Role[] = ["SUPPORTER", "CREATOR"];

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  if (FLEXTV_AUTH) return flextvSession(token);
  // A suspended or withdrawn member is treated as signed out on every request (the backend must enforce this too).
  if (USE_MOCK && token === MOCK_TOKEN && !mockSessionState.revoked && !isMemberSuspended(MOCK_USER_ID) && !isWithdrawn()) {
    // Display fields follow the (editable) mock account.
    const { nickname, ssumnationId, avatarUrl } = mockAccount;
    return { userId: MOCK_USER_ID, nickname, ssumnationId, avatarUrl, roles: [...(mockSessionState.roles ?? DEFAULT_MOCK_ROLES)] };
  }
  return null;
}

export const hasRole = (session: Session | null, role: Role): boolean => !!session && session.roles.includes(role);

/**
 * Session of a member with the Creator role, or `null`. Every creator-studio read and Server Action
 * uses this instead of `getSession()`, so a signed-in supporter cannot call creator APIs directly.
 * With FLEXTV: its broadcasters (lib/flextv/auth.ts `sessionFromMember`). Mock: TBD how the role is granted.
 */
export async function getCreatorSession(): Promise<Session | null> {
  const session = await getSession();
  return hasRole(session, "CREATOR") ? session : null;
}

/**
 * Issues the session cookie after the credentials were accepted. With FLEXTV, `tokens` are the member's FLEXTV tokens
 * and `session` (when the caller already knows the member) spares the next page a lookup.
 */
export async function startSession({ keepSignedIn, tokens, session }: { keepSignedIn: boolean; tokens?: FlextvTokens; session?: Session | null }) {
  if (FLEXTV_AUTH) {
    if (!tokens) throw new Error("A FLEXTV session needs the member's tokens.");
    applyCookieWrites(await cookies(), sessionCookieWrites(tokens, keepSignedIn));
    if (session) rememberFlextvSession(tokens.accessToken, session);
    return;
  }
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

/**
 * Ends the session on this site. With FLEXTV the member's tokens stay valid: FLEXTV keeps one token pair per member for
 * all their devices, so revoking it would also sign them out of FLEXTV's app.
 */
export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (FLEXTV_AUTH) {
    if (token) flextvSessions.delete(token);
    applyCookieWrites(jar, clearSessionCookieWrites());
    return;
  }
  jar.delete(SESSION_COOKIE);
}

/**
 * Invalidates the current session on the server without touching the cookie, so the page that
 * called the Server Action is not re-rendered immediately (the success modal stays visible).
 * The next request is treated as signed out.
 */
export async function revokeSession() {
  if (FLEXTV_AUTH) {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (token) {
      flextvSessions.delete(token);
      revokedTokens.add(token);
    }
    return;
  }
  if (USE_MOCK) mockSessionState.revoked = true;
}

/** Writes cookies through next/headers or a route handler's response — both take (name, value, options). */
export function applyCookieWrites(target: { set: (name: string, value: string, options: CookieWrite["options"]) => unknown }, writes: CookieWrite[]) {
  for (const { name, value, options } of writes) target.set(name, value, options);
}

const MOCK_USER_ID = "u-hongGD123";

/* ── FLEXTV session lookup ───────────────────────────────── */

/** How long one server reuses FLEXTV's answer for a token: a 정지 or a nickname change shows within this time. */
const SESSION_TTL_MS = 15_000;
const MAX_SESSIONS = 1_000;

type Entry = { at: number; session: Promise<Session | null> };
const g = globalThis as typeof globalThis & { __ssumnationFlextvSessions?: Map<string, Entry>; __ssumnationRevokedTokens?: Set<string> };
const flextvSessions = (g.__ssumnationFlextvSessions ??= new Map());
const revokedTokens = (g.__ssumnationRevokedTokens ??= new Set());

export function rememberFlextvSession(accessToken: string, session: Session) {
  revokedTokens.delete(accessToken);
  remember(accessToken, Promise.resolve(session));
}

function remember(token: string, session: Promise<Session | null>) {
  if (flextvSessions.size >= MAX_SESSIONS) {
    const now = Date.now();
    for (const [key, entry] of flextvSessions) if (now - entry.at >= SESSION_TTL_MS) flextvSessions.delete(key);
    if (flextvSessions.size >= MAX_SESSIONS) flextvSessions.delete(flextvSessions.keys().next().value!);
  }
  flextvSessions.set(token, { at: Date.now(), session });
}

async function flextvSession(token: string): Promise<Session | null> {
  if (revokedTokens.has(token)) return null;
  const cached = flextvSessions.get(token);
  if (cached && Date.now() - cached.at < SESSION_TTL_MS) return copy(await cached.session);
  const lookup = fetchMyProfile(token).then(
    (member) => (member ? sessionFromMember(member) : null),
    (error: unknown) => {
      // FLEXTV unreachable: signed out for this request, asked again on the next one.
      flextvSessions.delete(token);
      console.error("FLEXTV session lookup failed", error);
      return null;
    }
  );
  // Concurrent reads of one page share the lookup.
  remember(token, lookup);
  return copy(await lookup);
}

const copy = (session: Session | null) => session && { ...session, roles: [...session.roles] };
