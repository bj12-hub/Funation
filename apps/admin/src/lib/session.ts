import { cookies } from "next/headers";

/**
 * Operator session of the admin app (server only). Separate from the site: its own cookie on the admin
 * origin. The mock signs in one development operator; real operator auth (SSO / 2FA / IP allowlist) is TBD.
 */

export const OPERATOR_COOKIE = "somnation_admin_session";
const MOCK_OPERATOR_TOKEN = "mock-operator";
const MOCK_OPERATOR = { id: "adm-operator", name: "운영자" } as const;

export type Operator = { id: string; name: string };

export const isMock = () => process.env.ADMIN_USE_MOCK !== "false";

export async function getOperator(): Promise<Operator | null> {
  const token = (await cookies()).get(OPERATOR_COOKIE)?.value;
  if (isMock() && token === MOCK_OPERATOR_TOKEN) return { ...MOCK_OPERATOR };
  return null;
}

export async function startMockOperatorSession(): Promise<Operator> {
  if (!isMock()) throw new Error("Operator sign-in is not connected yet.");
  (await cookies()).set(OPERATOR_COOKIE, MOCK_OPERATOR_TOKEN, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/" });
  return { ...MOCK_OPERATOR };
}

export async function endOperatorSession() {
  (await cookies()).delete(OPERATOR_COOKIE);
}
