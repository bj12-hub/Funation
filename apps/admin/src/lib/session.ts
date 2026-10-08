import { cookies } from "next/headers";

/**
 * Operator session of the admin app (server only). The admin app runs on its own subdomain
 * (e.g. admin.<site domain>), so its cookie is host-only: no Domain attribute, never sent to the site,
 * and the site's cookies are never sent here. In production the `__Host-` prefix makes the browser
 * enforce that (Secure, Path=/, no Domain). The mock signs in one development operator; real operator
 * auth (SSO / 2FA / IP allowlist) is TBD.
 */

const secure = process.env.NODE_ENV === "production";
export const OPERATOR_COOKIE = secure ? "__Host-ssumnation_admin" : "ssumnation_admin_session";
const MOCK_OPERATOR_TOKEN = "mock-operator";
const MOCK_OPERATOR = { id: "adm-operator", name: "운영자" } as const;
/** Operators are signed out after 8 hours (the real session lifetime / idle timeout is TBD). */
const SESSION_SECONDS = 8 * 60 * 60;

export type Operator = { id: string; name: string };

/**
 * Mock operator sign-in. Development: on unless `ADMIN_USE_MOCK=false`. Production: off unless explicitly
 * `ADMIN_USE_MOCK=true` (a demo deployment only), so a missing or empty variable never opens the console.
 */
export const isMock = () =>
  process.env.NODE_ENV === "production" ? process.env.ADMIN_USE_MOCK === "true" : process.env.ADMIN_USE_MOCK !== "false";

export async function getOperator(): Promise<Operator | null> {
  const token = (await cookies()).get(OPERATOR_COOKIE)?.value;
  if (isMock() && token === MOCK_OPERATOR_TOKEN) return { ...MOCK_OPERATOR };
  return null;
}

export async function startMockOperatorSession(): Promise<Operator> {
  if (!isMock()) throw new Error("Operator sign-in is not connected yet.");
  (await cookies()).set(OPERATOR_COOKIE, MOCK_OPERATOR_TOKEN, { httpOnly: true, sameSite: "strict", secure, path: "/", maxAge: SESSION_SECONDS });
  return { ...MOCK_OPERATOR };
}

export async function endOperatorSession() {
  // Browsers ignore a `__Host-` Set-Cookie without Secure, so the deletion repeats the cookie's attributes.
  (await cookies()).delete({ name: OPERATOR_COOKIE, path: "/", secure, httpOnly: true, sameSite: "strict" });
}
