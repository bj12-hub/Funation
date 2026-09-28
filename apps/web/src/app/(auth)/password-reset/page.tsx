import type { Metadata } from "next";
import { PasswordResetFlow } from "@/features/auth/password-reset";

export const metadata: Metadata = { title: "비밀번호 찾기 | Funation" };

export default function PasswordResetPage() {
  return <PasswordResetFlow />;
}
