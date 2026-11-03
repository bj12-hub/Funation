import { NextResponse, type NextRequest } from "next/server";
import { deviceContextFrom, sessionFromMember, signInWithProvider, type SignInOutcome } from "@/lib/flextv/auth";
import { FLEXTV_AUTH } from "@/lib/flextv/mode";
import {
  OAUTH_STATE_COOKIE,
  SOCIAL_FLOW_SECONDS,
  SOCIAL_SIGNUP_COOKIE,
  callbackUrl,
  decodeOAuthState,
  encodeSocialSignup,
  exchangeCode,
  isConfiguredProvider,
  publicOrigin
} from "@/lib/flextv/social";
import { sessionCookieWrites } from "@/lib/flextv/tokens";
import { safeRedirectPath } from "@/lib/safeRedirect";
import { applyCookieWrites, rememberFlextvSession } from "@/lib/session";

/**
 * 간편 로그인 callback (lib/flextv/social.ts). Only the state this browser was given at /auth/[provider] is accepted;
 * the code is exchanged on the server and FLEXTV signs the member in. A social account FLEXTV does not know yet goes on
 * to /signup/social with its token in an httpOnly cookie (never in the address). Failures return to /login with a
 * `social` reason the login screen explains.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const origin = publicOrigin(request);
  const saved = decodeOAuthState(request.cookies.get(OAUTH_STATE_COOKIE)?.value);
  const redirect = (path: string) => {
    const response = NextResponse.redirect(`${origin}${path}`);
    response.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/auth", maxAge: 0 });
    response.headers.set("Cache-Control", "no-store");
    return response;
  };

  if (!FLEXTV_AUTH || !isConfiguredProvider(provider)) return redirect("/login?social=unavailable");
  const query = request.nextUrl.searchParams;
  const state = query.get("state");
  if (!saved || saved.provider !== provider || !state || state !== saved.state) return redirect("/login?social=failed");
  const code = query.get("code");
  // The member closed the provider's consent screen (error=access_denied …).
  if (query.get("error") || !code) return redirect("/login?social=cancelled");

  const providerToken = await exchangeCode(provider, { code, state, redirectUri: callbackUrl(origin, provider) }).catch(() => null);
  if (!providerToken) return redirect("/login?social=failed");

  let outcome: SignInOutcome | null;
  try {
    outcome = await signInWithProvider(provider, providerToken, deviceContextFrom(request.headers));
  } catch {
    outcome = null;
  }

  if (outcome?.kind === "OK") {
    const session = sessionFromMember(outcome.member);
    if (!session) return redirect("/login?social=blocked");
    // Checked again although /auth/[provider] stored a checked path: the cookie is input like any other.
    const response = redirect(safeRedirectPath(saved.next));
    applyCookieWrites(response.cookies, sessionCookieWrites(outcome.tokens, false));
    rememberFlextvSession(outcome.tokens.accessToken, session);
    return response;
  }
  if (outcome?.kind === "NEW_MEMBER") {
    const response = redirect("/signup/social");
    response.cookies.set(SOCIAL_SIGNUP_COOKIE, encodeSocialSignup({ provider, next: saved.next, token: providerToken }), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SOCIAL_FLOW_SECONDS
    });
    return response;
  }
  return redirect(outcome?.kind === "BLOCKED" ? "/login?social=blocked" : "/login?social=failed");
}
