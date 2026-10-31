"use client";

import { PageError } from "@/components/layout/PageError";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** Fallback ERROR state for site pages without their own error boundary (header and menu stay). */
export default function MainError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  return <PageError title={t("page.loadError")} onRetry={reset} />;
}
