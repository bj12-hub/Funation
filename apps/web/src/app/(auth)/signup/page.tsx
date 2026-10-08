import type { Metadata } from "next";
import { SignupFlow } from "@/features/auth/signup";

export const metadata: Metadata = { title: "회원가입 | Ssumnation" };

export default function SignupPage() {
  return <SignupFlow />;
}
