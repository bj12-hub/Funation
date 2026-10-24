/**
 * Server-to-server calls to FLEXTV's API (`server/` of FLEXTV's web repository). Server code only: the browser never
 * talks to FLEXTV directly, so FLEXTV's tokens stay in Ssumnation's httpOnly cookies and no CORS entry is needed.
 *
 * FLEXTV answers in several shapes (a JSON object, a bare string such as "ok", an empty 401), so callers get the
 * status and the parsed body and map them themselves. A network failure or a timeout throws FlextvUnavailableError.
 */

const TIMEOUT_MS = 10_000;

export class FlextvUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "FlextvUnavailableError";
  }
}

export type FlextvRequest = {
  method?: "GET" | "POST";
  /** Sent as JSON (FLEXTV's body parser reads JSON and forms alike). */
  body?: Record<string, unknown>;
  /** FLEXTV access token, sent as `Authorization: Bearer`. */
  token?: string;
  /** The member's IP: FLEXTV trusts X-Forwarded-For (`app.proxy`) for its black-IP list, sign-up checks and login counts. */
  clientIp?: string | null;
};

export type FlextvResponse = {
  status: number;
  /** Parsed JSON, the raw text when it is not JSON, or null for an empty body. */
  data: unknown;
  /** Set-Cookie lines: FLEXTV's sign-up hands out its tokens only as cookies. */
  setCookies: string[];
};

export function flextvApiUrl(): string {
  const url = process.env.FLEXTV_API_URL;
  if (!url) throw new FlextvUnavailableError("FLEXTV_API_URL is not set.");
  return url.replace(/\/+$/, "");
}

export async function flextvRequest(path: string, { method = "GET", body, token, clientIp }: FlextvRequest = {}): Promise<FlextvResponse> {
  const headers = new Headers({ Accept: "application/json" });
  if (body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (clientIp) headers.set("X-Forwarded-For", clientIp);
  // Unset = FLEXTV's own members (2026-10-25 결정: 기존 FLEXTV 회원 그대로). A tenant code would scope sign-up to it.
  const siteCode = process.env.FLEXTV_SITE_CODE;
  if (siteCode) headers.set("x-site-code", siteCode);

  let response: Response;
  try {
    response = await fetch(`${flextvApiUrl()}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
  } catch (error) {
    throw new FlextvUnavailableError(`FLEXTV ${method} ${path} failed`, { cause: error });
  }
  const text = await response.text().catch(() => "");
  return { status: response.status, data: parseBody(text), setCookies: response.headers.getSetCookie?.() ?? [] };
}

export function parseBody(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
