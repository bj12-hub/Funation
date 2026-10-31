import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/login";
import { FLEXTV_AUTH } from "@/lib/flextv/mode";
import { configuredProviders } from "@/lib/flextv/social";
import { safeRedirectPath } from "@/lib/safeRedirect";
import { getSession } from "@/lib/session";
import { getSurface } from "@/lib/surface";

export const metadata: Metadata = {
  title: "로그인 | Ssumnation"
};

/** Why a 간편 로그인 came back to the login screen (app/auth/[provider]/callback). Code-first copy. */
const SOCIAL_NOTICES: Record<string, string> = {
  failed: "간편 로그인을 완료하지 못했어요. 다시 시도해 주세요",
  cancelled: "간편 로그인이 취소되었어요",
  blocked: "운영 정책에 따라 이용이 제한된 계정입니다. 고객센터로 문의해 주세요",
  unavailable: "지금은 간편 로그인을 사용할 수 없어요. 아이디로 로그인해 주세요"
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[]; social?: string | string[] }> }) {
  const query = await searchParams;
  const next = safeRedirectPath(query.next);
  // Already signed in: go where the user was heading.
  if (await getSession()) redirect(next);
  const social = typeof query.social === "string" ? (SOCIAL_NOTICES[query.social] ?? null) : null;
  // 고객센터 (/support) is a site page: the 도우미 domain names it in plain text instead of linking it.
  return (
    <LoginForm next={next} supportLink={(await getSurface()) === "site"} socialProviders={FLEXTV_AUTH ? configuredProviders() : []} notice={social} />
  );
}
