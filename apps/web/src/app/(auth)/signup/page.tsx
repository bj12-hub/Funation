import type { Metadata } from "next";
import { SignupFlow } from "@/features/auth/signup";
import { getSurface } from "@/lib/surface";

export const metadata: Metadata = { title: "회원가입 | Ssumnation" };

export default async function SignupPage() {
  // 간편 로그인 연동 lives in 마이페이지, which the 도우미 domain does not serve.
  return <SignupFlow socialLink={(await getSurface()) === "site"} />;
}
