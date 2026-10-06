import { USE_MOCK } from "@/lib/mock";
import { sameSecret } from "@/lib/secret";
import type { AdminActor } from "@/services/admin/adminTypes";

/**
 * Admin API authorisation (`/api/admin/*`). The admin console is a separate app (apps/admin); its server
 * calls these routes with a shared secret and names the operator it acts for, which goes into the audit
 * log. No cookies are involved, so browsers on the site cannot reach the admin API.
 *
 * - `Authorization: Bearer <ADMIN_API_TOKEN>` — required. Production refuses to serve without the env var.
 * - `X-Admin-Operator-Id` / `X-Admin-Operator-Name` (URI-encoded) — the operator.
 * Operator authentication itself (SSO / 2FA / IP allowlist) and per-operator tokens are TBD.
 */

/** Development-only fallback so the mock setup works without an env file (never used in production). */
const DEV_TOKEN = "dev-only-admin-api-token";
/** The `.env.example` placeholder, and anything this short, counts as "not configured" (the API answers 503). */
const PLACEHOLDER_TOKEN = "replace-with-a-long-random-secret";
export const ADMIN_TOKEN_MIN_LENGTH = 32;

function expectedToken(): string | null {
  const fromEnv = process.env.ADMIN_API_TOKEN;
  if (fromEnv) return fromEnv.length >= ADMIN_TOKEN_MIN_LENGTH && fromEnv !== PLACEHOLDER_TOKEN ? fromEnv : null;
  return USE_MOCK && process.env.NODE_ENV !== "production" ? DEV_TOKEN : null;
}

export type AdminAuth = { ok: true; admin: AdminActor } | { ok: false; status: 401 | 503 };

export function authorizeAdminRequest(request: Request): AdminAuth {
  const expected = expectedToken();
  if (!expected) return { ok: false, status: 503 };
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !sameSecret(token, expected)) return { ok: false, status: 401 };
  const id = request.headers.get("x-admin-operator-id") ?? "";
  let name = "";
  try {
    name = decodeURIComponent(request.headers.get("x-admin-operator-name") ?? "").trim();
  } catch {
    name = "";
  }
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id) || !name || name.length > 40) return { ok: false, status: 401 };
  return { ok: true, admin: { userId: id, nickname: name } };
}

type Ctx<P> = { params: Promise<P> };

/**
 * Wraps an admin route: authorises, runs the handler and returns JSON. `null` from a handler means
 * "not found". Responses are never cached.
 */
export function adminRoute<P = Record<string, never>>(handler: (admin: AdminActor, request: Request, params: P) => Promise<unknown>) {
  return async (request: Request, ctx: Ctx<P>) => {
    const auth = authorizeAdminRequest(request);
    const headers = { "Cache-Control": "no-store" };
    if (!auth.ok) return Response.json({ status: auth.status === 401 ? "UNAUTHORIZED" : "UNAVAILABLE" }, { status: auth.status, headers });
    const result = await handler(auth.admin, request, await ctx.params);
    if (result === null || result === undefined) return Response.json({ status: "NOT_FOUND" }, { status: 404, headers });
    return Response.json(result, { headers });
  };
}

/** JSON body or `{}` (malformed bodies are validated by the service like any other bad input). */
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const v = await request.json();
    return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export const queryOf = (request: Request) => Object.fromEntries(new URL(request.url).searchParams);
