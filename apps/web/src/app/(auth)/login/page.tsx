import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/login";
import { FLEXTV_AUTH } from "@/lib/flextv/mode";
import { configuredProviders } from "@/lib/flextv/social";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { safeRedirectPath } from "@/lib/safeRedirect";
import { getSession } from "@/lib/session";
import { getSurface } from "@/lib/surface";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("auth.metaLogin") };
}

/** Why a 간편 로그인 came back to the login screen (app/auth/[provider]/callback). Code-first copy. */
const SOCIAL_NOTICES: Record<string, MessageKey> = {
  failed: "auth.socialFailed",
  cancelled: "auth.socialCancelled",
  blocked: "auth.socialBlocked",
  unavailable: "auth.socialUnavailable"
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[]; social?: string | string[] }> }) {
  const query = await searchParams;
  const next = safeRedirectPath(query.next);
  // Already signed in: go where the user was heading.
  if (await getSession()) redirect(next);
  const social = typeof query.social === "string" && Object.hasOwn(SOCIAL_NOTICES, query.social) ? (await getT())(SOCIAL_NOTICES[query.social]) : null;
  // 고객센터 (/support) is a site page: the 도우미 domain names it in plain text instead of linking it.
  return (
    <LoginForm next={next} supportLink={(await getSurface()) === "site"} socialProviders={FLEXTV_AUTH ? configuredProviders() : []} notice={social} />
  );
}
