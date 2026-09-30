import type { Operator } from "./session";

/**
 * Server-side client for the site's admin API (`/api/admin/*`). The shared secret never reaches a
 * browser: only this module reads it, and it is imported from Server Components and Server Actions.
 *
 * - SITE_API_URL — the site (default http://localhost:3000, the dev:sync server)
 * - ADMIN_API_TOKEN — must match the site's ADMIN_API_TOKEN (dev fallback matches the site's mock default)
 */

const DEV_TOKEN = "dev-only-admin-api-token";

function config() {
  const token = process.env.ADMIN_API_TOKEN || (process.env.NODE_ENV !== "production" ? DEV_TOKEN : "");
  if (!token) throw new SiteApiError("UNAVAILABLE", "ADMIN_API_TOKEN이 설정되지 않았어요.");
  return { base: (process.env.SITE_API_URL || "http://localhost:3000").replace(/\/$/, ""), token };
}

export class SiteApiError extends Error {
  constructor(
    readonly code: "UNAUTHORIZED" | "UNAVAILABLE",
    message: string
  ) {
    super(message);
  }
}

/** GET returning the payload, or `null` for 404. Throws SiteApiError when the site is unreachable or refuses. */
export async function siteGet<T>(operator: Operator, path: string): Promise<T | null> {
  return request<T>(operator, "GET", path);
}

/** Writes return the site's result object (`{ status: ... }`), including INVALID / NOT_FOUND. */
export async function siteSend<T>(operator: Operator, method: "POST" | "PUT" | "DELETE", path: string, body?: unknown): Promise<T> {
  const res = await request<T>(operator, method, path, body, true);
  return res as T;
}

async function request<T>(operator: Operator, method: string, path: string, body?: unknown, write = false): Promise<T | null> {
  const { base, token } = config();
  let res: Response;
  try {
    res = await fetch(`${base}/api/admin${path}`, {
      method,
      cache: "no-store",
      headers: {
        authorization: `Bearer ${token}`,
        "x-admin-operator-id": operator.id,
        "x-admin-operator-name": encodeURIComponent(operator.name),
        ...(body === undefined ? {} : { "content-type": "application/json" })
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10_000)
    });
  } catch {
    throw new SiteApiError("UNAVAILABLE", `사이트 API(${base})에 연결할 수 없어요. 사이트 서버가 켜져 있는지 확인해 주세요.`);
  }
  if (res.status === 401) throw new SiteApiError("UNAUTHORIZED", "사이트 API가 요청을 거부했어요. ADMIN_API_TOKEN을 확인해 주세요.");
  if (res.status === 503) throw new SiteApiError("UNAVAILABLE", "사이트 API가 아직 설정되지 않았어요 (ADMIN_API_TOKEN).");
  if (res.status === 404) return write ? ({ status: "NOT_FOUND" } as T) : null;
  if (!res.ok) throw new SiteApiError("UNAVAILABLE", `사이트 API 오류 (${res.status})`);
  return (await res.json()) as T;
}
