import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import styles from "./NotFoundView.module.css";

/**
 * 공통 404 — code-first (no Figma frame). Used inside the site shell (`(main)/not-found.tsx`) and on its
 * own for unmatched URLs (`app/not-found.tsx`). Deleted, hidden (신고 처리) and suspended content land
 * here too, so the copy does not say why the page is missing.
 */
export async function NotFoundView({ standalone = false }: { standalone?: boolean }) {
  const t = await getT();
  return (
    <section className={`${styles.root} ${standalone ? styles.standalone : ""}`} aria-labelledby="not-found-title">
      {standalone && (
        <Link href="/" className={styles.logo} aria-label={t("common.homeAria")}>
          Ssumnation
        </Link>
      )}
      <p className={styles.code} aria-hidden="true">
        404
      </p>
      <h1 id="not-found-title" className={styles.title}>
        {t("page.notFoundTitle")}
      </h1>
      <p className={styles.description}>{t("page.notFoundDescription")}</p>
      <div className={styles.actions}>
        <Link href="/" className={styles.primary}>
          {t("page.goHome")}
        </Link>
        <Link href="/creators" className={styles.secondary}>
          {t("page.findCreators")}
        </Link>
        <Link href="/support" className={styles.secondary}>
          {t("page.support")}
        </Link>
      </div>
    </section>
  );
}
