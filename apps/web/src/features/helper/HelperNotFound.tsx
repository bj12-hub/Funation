import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import styles from "./helper.module.css";

/** 404 on the helper domain — code-first (no Figma frame). The site's own pages are not served there. */
export async function HelperNotFound() {
  const t = await getT();
  return (
    <main className={styles.landing}>
      <div>
        <h1 className={styles.landingTitle}>{t("helper.notFoundTitle")}</h1>
        <p className={styles.landingText}>{t("helper.notFoundText")}</p>
      </div>
      <div className={styles.landingActions}>
        <Link href="/" className={styles.primary}>
          {t("helper.helperHome")}
        </Link>
      </div>
    </main>
  );
}
