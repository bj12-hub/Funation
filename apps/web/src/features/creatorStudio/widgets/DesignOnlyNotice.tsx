import Link from "next/link";
import { useI18n } from "@/lib/i18n/I18nProvider";
import styles from "./widgets.module.css";

/**
 * With FLEXTV (phase 8) a 위젯 popup sets only the overlay's look: where the rules are set instead (the form's
 * `live.designOnly`).
 */
export function DesignOnlyNotice({ rules }: { rules: string }) {
  const { t } = useI18n();
  return (
    <p className={styles.notice}>
      {t("widgetForm.designOnlyBefore", { rules })}{" "}
      <Link href="/creator/donation-types" className={styles.linkButton}>
        {t("widgetForm.designOnlyLink")}
      </Link>
      {t("widgetForm.designOnlyAfter")}
    </p>
  );
}
