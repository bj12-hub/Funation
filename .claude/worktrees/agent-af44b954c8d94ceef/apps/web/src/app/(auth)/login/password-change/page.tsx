import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PasswordChangePrompt } from "@/features/auth/login";
import { safeRedirectPath } from "@/lib/safeRedirect";
import { getSession } from "@/lib/session";

// Figma: 비밀번호 변경 권유 718:335 — reached from the login action when the password is old.
export const metadata: Metadata = { title: "비밀번호 변경 안내 | Somnation" };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const next = safeRedirectPath((await searchParams).next);
  if (!(await getSession())) redirect(`/login?next=${encodeURIComponent(next)}`);
  return <PasswordChangePrompt next={next} />;
}
