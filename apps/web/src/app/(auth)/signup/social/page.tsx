import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SocialSignupFlow } from "@/features/auth/signup";
import { FLEXTV_AUTH } from "@/lib/flextv/mode";
import { SOCIAL_SIGNUP_COOKIE, decodeSocialSignup } from "@/lib/flextv/social";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("flextvSignup.meta") };
}

/** 간편 가입 after a 카카오 · 네이버 · 구글 login FLEXTV did not know (app/auth/[provider]/callback). */
export default async function SocialSignupPage() {
  if (!FLEXTV_AUTH) notFound();
  const pending = decodeSocialSignup((await cookies()).get(SOCIAL_SIGNUP_COOKIE)?.value);
  // Opened directly, or the 10 minutes passed: the ordinary sign-up.
  if (!pending) redirect("/signup");
  // A suggestion within FLEXTV's 2–10 characters; FLEXTV refuses a taken one on submit.
  const suggested = `썸네이션${Math.floor(1000 + Math.random() * 9000)}`;
  return <SocialSignupFlow provider={pending.provider} suggestedNickname={suggested} />;
}
