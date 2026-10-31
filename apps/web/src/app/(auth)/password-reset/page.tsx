import type { Metadata } from "next";
import { PasswordResetFlow } from "@/features/auth/password-reset";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("auth.metaPasswordReset") };
}

export default function PasswordResetPage() {
  return <PasswordResetFlow />;
}
