import Link from "next/link";
import { DownloadIcon } from "@/components/icons";
import { getT } from "@/lib/i18n/server";
import styles from "./wallet.module.css";

const WINDOW = 5;

/** Figma 640:2 pagination (<< < 1 2 3 4 5 > >>) + CSV 다운로드. */
export async function HistoryFooter({
  page,
  totalPages,
  hrefFor,
  csvHref,
  hasRows
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
  csvHref: string;
  hasRows: boolean;
}) {
  const t = await getT();
  const start = Math.max(1, Math.min(page - Math.floor(WINDOW / 2), totalPages - WINDOW + 1));
  const pages = Array.from({ length: Math.min(WINDOW, totalPages) }, (_, i) => start + i);

  return (
    <div className={styles.footer}>
      <nav className={styles.pagination} aria-label={t("wallet.pages")}>
        <PageLink href={hrefFor(1)} disabled={page === 1} label={t("wallet.firstPage")}>
          «
        </PageLink>
        <PageLink href={hrefFor(page - 1)} disabled={page === 1} label={t("wallet.previousPage")}>
          ‹
        </PageLink>
        {pages.map((p) =>
          p === page ? (
            <span key={p} className={`${styles.pageButton} ${styles.pageCurrent}`} aria-current="page">
              {p}
            </span>
          ) : (
            <Link key={p} href={hrefFor(p)} className={styles.pageButton}>
              {p}
            </Link>
          )
        )}
        <PageLink href={hrefFor(page + 1)} disabled={page === totalPages} label={t("wallet.nextPage")}>
          ›
        </PageLink>
        <PageLink href={hrefFor(totalPages)} disabled={page === totalPages} label={t("wallet.lastPage")}>
          »
        </PageLink>
      </nav>
      {hasRows ? (
        <a href={csvHref} className={styles.csvButton} download>
          <DownloadIcon aria-hidden="true" />
          {t("wallet.downloadCsv")}
        </a>
      ) : (
        <span className={styles.csvButton} aria-disabled="true">
          <DownloadIcon aria-hidden="true" />
          {t("wallet.downloadCsv")}
        </span>
      )}
    </div>
  );
}

function PageLink({ href, disabled, label, children }: { href: string; disabled: boolean; label: string; children: string }) {
  if (disabled) {
    return (
      <span className={`${styles.pageButton} ${styles.pageDisabled}`} aria-disabled="true" aria-label={label}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={styles.pageButton} aria-label={label}>
      {children}
    </Link>
  );
}
