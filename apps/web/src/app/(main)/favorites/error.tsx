"use client";

import { PageError } from "@/components/layout/PageError";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** ERROR state for favorites. */
export default function FavoritesError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  return <PageError title={t("myFavorites.loadError")} onRetry={reset} />;
}
