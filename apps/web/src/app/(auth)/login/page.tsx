import type { Metadata } from "next";
import { LoginForm } from "@/features/auth/login";

export const metadata: Metadata = {
  title: "로그인 | Funation"
};

export default function LoginPage() {
  return <LoginForm />;
}
