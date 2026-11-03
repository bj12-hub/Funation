import { isSocialProvider, type SocialProvider } from "./auth";

/**
 * 간편 로그인 (카카오 · 네이버 · 구글) through FLEXTV (docs/development/flextv-backend.md "간편 로그인").
 *
 * Ssumnation must use **FLEXTV's own apps** at each provider: FLEXTV checks that a Kakao token came from its app, that a
 * Google ID token was issued to its client, and Kakao and Naver give each app its own user id — another app would turn
 * every existing FLEXTV member into a new one. Ssumnation's callback addresses are added to those apps.
 *
 * Flow: /auth/[provider] (state cookie) → provider → /auth/[provider]/callback → the code is exchanged here, on the
 * server → FLEXTV signs the member in, or (not a member yet) the provider's token waits in an httpOnly cookie while
 * /signup/social asks for the terms and a nickname.
 */

type ProviderSettings = { clientId: string; clientSecret: string | null };

function settings(provider: SocialProvider): ProviderSettings | null {
  const env = process.env;
  const pick = (id?: string, secret?: string, secretRequired = true) =>
    id && (secret || !secretRequired) ? { clientId: id, clientSecret: secret || null } : null;
  switch (provider) {
    case "kakao":
      // A Kakao REST API key; the client secret only when the app turned it on.
      return pick(env.KAKAO_REST_API_KEY, env.KAKAO_CLIENT_SECRET, false);
    case "naver":
      return pick(env.NAVER_CLIENT_ID, env.NAVER_CLIENT_SECRET);
    case "google":
      return pick(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
  }
}

/** Providers whose app settings are present, in the order the login screen shows them. */
export const configuredProviders = (): SocialProvider[] => (["kakao", "naver", "google"] as const).filter((p) => settings(p) !== null);

export const isConfiguredProvider = (value: unknown): value is SocialProvider => isSocialProvider(value) && settings(value) !== null;

export function authorizeUrl(provider: SocialProvider, { state, redirectUri }: { state: string; redirectUri: string }): string {
  const s = settings(provider);
  if (!s) throw new Error(`${provider} login is not configured.`);
  const query = (base: string, params: Record<string, string>) => `${base}?${new URLSearchParams(params)}`;
  switch (provider) {
    case "kakao":
      return query("https://kauth.kakao.com/oauth/authorize", { response_type: "code", client_id: s.clientId, redirect_uri: redirectUri, state });
    case "naver":
      return query("https://nid.naver.com/oauth2.0/authorize", { response_type: "code", client_id: s.clientId, redirect_uri: redirectUri, state });
    case "google":
      return query("https://accounts.google.com/o/oauth2/v2/auth", {
        response_type: "code",
        client_id: s.clientId,
        redirect_uri: redirectUri,
        scope: "openid profile",
        state,
        prompt: "select_account"
      });
  }
}

const TOKEN_URL: Record<SocialProvider, string> = {
  kakao: "https://kauth.kakao.com/oauth/token",
  naver: "https://nid.naver.com/oauth2.0/token",
  google: "https://oauth2.googleapis.com/token"
};

/**
 * Exchanges the authorization code for the token FLEXTV signs in with: Kakao's or Naver's access token, Google's ID
 * token. Null when the provider refuses.
 */
export async function exchangeCode(provider: SocialProvider, { code, state, redirectUri }: { code: string; state: string; redirectUri: string }): Promise<string | null> {
  const s = settings(provider);
  if (!s) return null;
  const form = new URLSearchParams({ grant_type: "authorization_code", client_id: s.clientId, redirect_uri: redirectUri, code });
  if (s.clientSecret) form.set("client_secret", s.clientSecret);
  if (provider === "naver") form.set("state", state);
  const response = await fetch(TOKEN_URL[provider], {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8", Accept: "application/json" },
    body: form,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) return null;
  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  const token = provider === "google" ? data?.id_token : data?.access_token;
  return typeof token === "string" && token.length > 0 ? token : null;
}

/* ── Cookies of the flow ─────────────────────────────────── */

/** The state of a started login: `{provider}.{state}.{next}` on /auth only, 10 minutes. */
export const OAUTH_STATE_COOKIE = "ssumnation_oauth";
/** A social account that is not a member yet: `{provider}.{next}.{token}`, 10 minutes. */
export const SOCIAL_SIGNUP_COOKIE = "ssumnation_social_signup";
export const SOCIAL_FLOW_SECONDS = 10 * 60;

export type OAuthState = { provider: SocialProvider; state: string; next: string };

export const encodeOAuthState = ({ provider, state, next }: OAuthState) => `${provider}.${state}.${encodeURIComponent(next)}`;

export function decodeOAuthState(value: string | undefined): OAuthState | null {
  const match = /^([a-z]+)\.([A-Za-z0-9-]{16,64})\.(.*)$/.exec(value ?? "");
  if (!match || !isSocialProvider(match[1])) return null;
  const next = safeDecode(match[3]);
  return next === null ? null : { provider: match[1], state: match[2], next };
}

export type SocialSignup = { provider: SocialProvider; next: string; token: string };

/** The next path is encoded without dots (encodeURIComponent keeps them), so the first two dots split the value. */
export const encodeSocialSignup = ({ provider, next, token }: SocialSignup) => `${provider}.${encodeURIComponent(next).replace(/\./g, "%2E")}.${token}`;

export function decodeSocialSignup(value: string | undefined): SocialSignup | null {
  const first = (value ?? "").indexOf(".");
  const second = first < 0 ? -1 : value!.indexOf(".", first + 1);
  if (second < 0) return null;
  const provider = value!.slice(0, first);
  const next = safeDecode(value!.slice(first + 1, second));
  const token = value!.slice(second + 1);
  if (!isSocialProvider(provider) || next === null || !/^[A-Za-z0-9._~+/=-]{10,4000}$/.test(token)) return null;
  return { provider, next, token };
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/**
 * The origin the browser used (the callback address must match what the provider has registered). Behind a proxy the
 * request URL is the internal one, so the forwarded host and protocol win; a forged one only fails at the provider,
 * which accepts registered addresses only.
 */
export function publicOrigin(request: { headers: Pick<Headers, "get">; nextUrl: { origin: string; protocol: string } }): string {
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || request.nextUrl.protocol.replace(/:$/, "");
  return host && /^[A-Za-z0-9.-]+(:\d+)?$/.test(host) && /^https?$/.test(proto) ? `${proto}://${host}` : request.nextUrl.origin;
}

export const callbackUrl = (origin: string, provider: SocialProvider) => `${origin}/auth/${provider}/callback`;
