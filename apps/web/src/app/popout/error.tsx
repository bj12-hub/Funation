"use client";

import { PageError } from "@/components/layout/PageError";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** ERROR state for the stand-alone chat windows (팝아웃 · 매니저 채팅창). */
export default function PopoutError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  return <PageError title={t("unifiedChat.windowLoadError")} onRetry={reset} />;
}
