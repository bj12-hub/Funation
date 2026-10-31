"use client";

import { Button } from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n/I18nProvider";
import styles from "./PageError.module.css";

/** ERROR state body for route `error.tsx` boundaries. */
export function PageError({ title, onRetry }: { title: string; onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <section className={styles.root} role="alert">
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.description}>{t("page.errorDescription")}</p>
      <Button onClick={onRetry}>{t("page.retry")}</Button>
    </section>
  );
}
