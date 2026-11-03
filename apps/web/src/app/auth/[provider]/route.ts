import { NextResponse, type NextRequest } from "next/server";
import { FLEXTV_AUTH } from "@/lib/flextv/mode";
import { OAUTH_STATE_COOKIE, SOCIAL_FLOW_SECONDS, authorizeUrl, callbackUrl, encodeOAuthState, isConfiguredProvider, publicOrigin } from "@/lib/flextv/social";
import { safeRedirectPath } from "@/lib/safeRedirect";

/**
 * 간편 로그인 start (lib/flextv/social.ts): `/auth/kakao?next=/mypage` sends the member to the provider with a fresh
 * state, kept in an httpOnly cookie that only `/auth/*` receives. The callback accepts only that state.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const origin = publicOrigin(request);
  if (!FLEXTV_AUTH || !isConfiguredProvider(provider)) return NextResponse.redirect(`${origin}/login?social=unavailable`);

  const next = safeRedirectPath(request.nextUrl.searchParams.get("next") ?? undefined);
  const state = crypto.randomUUID();
  const response = NextResponse.redirect(authorizeUrl(provider, { state, redirectUri: callbackUrl(origin, provider) }));
  response.cookies.set(OAUTH_STATE_COOKIE, encodeOAuthState({ provider, state, next }), {
    httpOnly: true,
    // Lax: the provider sends the member back with a top-level GET, which carries it.
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/auth",
    maxAge: SOCIAL_FLOW_SECONDS
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
