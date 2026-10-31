"use client";

import { PageError } from "@/components/layout/PageError";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** ERROR state for 로그인 · 회원가입 · 비밀번호 찾기 (the header stays). */
export default function AuthError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  return <PageError title={t("auth.loadError")} onRetry={reset} />;
}
