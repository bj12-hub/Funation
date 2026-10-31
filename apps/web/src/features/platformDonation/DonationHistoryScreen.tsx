import Link from "next/link";
import { formatNumber } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { HISTORY_LIST_MAX, HISTORY_TABS, SOURCE_LABEL, type HistoryItem, type HistoryView } from "@/services/platformDonation/platformTypes";
import { HistoryFilters } from "./HistoryFilters";
import { HISTORY_STATUS_KEY } from "./words";
import styles from "./history.module.css";

const dotted = (s: string) => s.replace(/-/g, ".");

type T = Awaited<ReturnType<typeof getT>>;

/** Figma 817:8038 · 817:8223 — 후원 내역 (route `/donation/history`). */
export async function DonationHistoryScreen({ view }: { view: HistoryView }) {
  const t = await getT();
  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams({ tab: view.tab, period: view.period, status: view.status, q: view.q, sort: view.sort });
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    for (const [k, v] of [...p.entries()]) if (!v || (k === "status" && v === "all") || (k === "sort" && v === "newest")) p.delete(k);
    return `/donation/history?${p}`;
  };

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("platformDonation.history")}</h1>
        <p className={styles.subtitle}>{t("platformDonation.historySubtitle")}</p>
      </header>

      <nav className={styles.tabs} aria-label={t("platformDonation.platform")}>
        {HISTORY_TABS.map((tab) => (
          <Link key={tab.key} href={href({ tab: tab.key, tx: null })} className={styles.tab} aria-current={view.tab === tab.key ? "page" : undefined}>
            {tab.key === "all" ? t("platformDonation.all") : tab.label}
          </Link>
        ))}
      </nav>

      <HistoryFilters key={`${view.tab}-${view.period}-${view.status}-${view.q}-${view.sort}`} tab={view.tab} period={view.period} status={view.status} q={view.q} sort={view.sort} />

      {/* Code-first (2026-10-06): 결과 건수 · 완료 합계 over every match, like FN 내역's 결과 · 합계. */}
      <p className={styles.summary} role="status">
        {t("platformDonation.summary", { total: formatNumber(view.total), fn: formatNumber(view.completedFn) })}
        {view.total > HISTORY_LIST_MAX && ` · ${t("platformDonation.summaryCap", { max: HISTORY_LIST_MAX })}`}
      </p>

      <div className={styles.body}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t("platformDonation.date")}</th>
                <th scope="col">{t("platformDonation.platform")}</th>
                <th scope="col">{t("platformDonation.creator")}</th>
                <th scope="col">{t("platformDonation.product")}</th>
                <th scope="col">{t("platformDonation.amount")}</th>
                <th scope="col">{t("platformDonation.status")}</th>
              </tr>
            </thead>
            <tbody>
              {view.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.empty}>
                    {t("platformDonation.empty")}
                  </td>
                </tr>
              ) : (
                view.items.map((i) => (
                  <tr key={i.transactionId} aria-selected={view.selected?.transactionId === i.transactionId || undefined}>
                    <td>
                      <Link href={href({ tx: i.transactionId })} className={styles.rowLink} scroll={false}>
                        {dotted(i.createdAt)}
                      </Link>
                    </td>
                    <td>{SOURCE_LABEL[i.source]}</td>
                    <td>{i.creatorName}</td>
                    <td>{i.productLabel}</td>
                    <td className={styles.amount}>{formatNumber(i.fnAmount)} FN</td>
                    <td>
                      <StatusBadge item={i} t={t} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <aside className={styles.detail} aria-label={t("platformDonation.detail")}>
          <div className={styles.detailHead}>
            <h2 className={styles.detailTitle}>{t("platformDonation.detail")}</h2>
            {view.selected && (
              <Link href={href({ tx: null })} className={styles.close} aria-label={t("platformDonation.closeDetail")} scroll={false}>
                ×
              </Link>
            )}
          </div>
          {view.selected ? (
            <Detail item={view.selected} t={t} />
          ) : (
            <p className={styles.detailEmpty}>{t("platformDonation.detailEmpty")}</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function StatusBadge({ item, t }: { item: HistoryItem; t: T }) {
  return (
    <span className={styles.badge} data-status={item.status}>
      {t(HISTORY_STATUS_KEY[item.status])}
    </span>
  );
}

function Detail({ item, t }: { item: HistoryItem; t: T }) {
  const rows: [string, string][] = [
    [t("platformDonation.txNo"), item.transactionId],
    [t("platformDonation.platform"), SOURCE_LABEL[item.source]],
    [t("platformDonation.recipient"), item.creatorName],
    [t("platformDonation.product"), item.productLabel],
    [t("platformDonation.paidFn"), `${formatNumber(item.fnAmount)} FN`],
    [t("platformDonation.txStatus"), t(HISTORY_STATUS_KEY[item.status])],
    [t("platformDonation.externalTxNo"), item.externalTransactionId ?? "-"],
    [t("platformDonation.date"), dotted(item.createdAt)],
    [t("platformDonation.completedAt"), item.completedAt ? dotted(item.completedAt) : "-"],
    [t("platformDonation.failureReason"), item.failureReason ?? t("platformDonation.notApplicable")]
  ];
  return (
    <>
      <StatusBadge item={item} t={t} />
      {/* 2026-10-08 결정: a platform donation whose result is unknown stays 처리중 while the server re-checks it. */}
      {item.status === "PROCESSING" && item.source !== "DIRECT" && (
        <p className={styles.detailEmpty} role="status">
          {t("platformDonation.checkingNote")}
        </p>
      )}
      <dl className={styles.detailList}>
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
