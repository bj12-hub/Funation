"use client";

import { PageError } from "@/components/layout/PageError";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** ERROR state for the platform donation pages (Figma 817:7826). */
export default function DonationError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  return <PageError title={t("platformDonation.loadError")} onRetry={reset} />;
}
