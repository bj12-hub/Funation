import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/login";
import { safeRedirectPath } from "@/lib/safeRedirect";
import { getSession } from "@/lib/session";
import { getSurface } from "@/lib/surface";

export const metadata: Metadata = {
  title: "로그인 | Ssumnation"
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const next = safeRedirectPath((await searchParams).next);
  // Already signed in: go where the user was heading.
  if (await getSession()) redirect(next);
  // 고객센터 (/support) is a site page: the 도우미 domain names it in plain text instead of linking it.
  return <LoginForm next={next} supportLink={(await getSurface()) === "site"} />;
}
