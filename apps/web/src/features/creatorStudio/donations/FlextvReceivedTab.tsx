import Link from "next/link";
import { formatNumber } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { LIST_PERIODS, type ListPeriodPreset } from "@/services/creator/donationManagementTypes";
import { RECEIVED_PAGE_SIZE, RECEIVED_QUERY_MAX, type FlextvReceivedPage } from "@/services/creator/flextvEarnings";
import { PageLink } from "./DonationListTab";
import { FlextvKindNav } from "./FlextvQuestTab";
import styles from "./donations.module.css";

const WINDOW = 5;
/** The services' `LIST_PERIODS` labels as message keys. */
const PERIOD_KEY: Record<Exclude<ListPeriodPreset, "year" | "range">, MessageKey> = {
  today: "flextvDonations.periodToday",
  "1w": "flextvDonations.period1w",
  "1m": "flextvDonations.period1m",
  "3m": "flextvDonations.period3m",
  "6m": "flextvDonations.period6m",
  "1y": "flextvDonations.period1y"
};
/** FLEXTV's rows are KST "yyyy-mm-dd hh:mm:ss": "2026.10.25 15:04". */
const formatAt = (at: string) => at.slice(0, 16).replaceAll("-", ".");

type Params = Record<string, string | number | undefined>;
function href(params: Params) {
  const sp = new URLSearchParams({ tab: "list" });
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") sp.set(k, String(v));
  return `/creator/donations?${sp}`;
}

/**
 * 받은 후원 with FLEXTV (phase 5; code-first, the 후원 리스트 539:156 layout). FLEXTV's list of the 렉스 the streamer
 * received: one row per 후원 or 선물 상품, filtered by period and FLEXTV's exact 닉네임 search. FLEXTV records no message
 * with the list.
 */
export async function FlextvReceivedTab({ data, quests = false }: { data: FlextvReceivedPage; quests?: boolean }) {
  const t = await getT();
  const { period, nickname, page, totalPages, total, items, sum } = data;
  const periodParams: Params = period.preset === "range" ? { period: "range", from: period.from, to: period.to } : { period: period.preset };
  const base: Params = { ...periodParams, q: nickname };
  const start = Math.max(1, Math.min(page - Math.floor(WINDOW / 2), totalPages - WINDOW + 1));
  const pages = Array.from({ length: Math.min(WINDOW, totalPages) }, (_, i) => start + i);
  const first = total === 0 ? 0 : (page - 1) * RECEIVED_PAGE_SIZE + 1;
  const last = Math.min(total, page * RECEIVED_PAGE_SIZE);

  return (
    <div className={styles.stack}>
      {/* With FLEXTV's Ssumnation endpoints (phase 6) the quests sent to the channel have their own list. */}
      {quests && <FlextvKindNav kind="all" t={t} />}
      <div className={styles.filterRow}>
        <nav className={styles.chipsRow} aria-label={t("flextvDonations.periodAria")}>
          {LIST_PERIODS.map((p) => (
            <Link key={p.key} href={href({ period: p.key, q: nickname })} className={`${styles.chip} ${period.preset === p.key ? styles.chipOn : ""}`} aria-current={period.preset === p.key ? "true" : undefined}>
              {t(PERIOD_KEY[p.key])}
            </Link>
          ))}
        </nav>
      </div>

      <form action="/creator/donations" method="get" className={styles.searchForm} role="search">
        <input type="hidden" name="tab" value="list" />
        <input type="hidden" name="period" value="range" />
        <span className={styles.dateRange}>
          <input type="date" name="from" aria-label={t("flextvDonations.from")} defaultValue={period.from} max={period.to} />
          <span aria-hidden="true">~</span>
          <input type="date" name="to" aria-label={t("flextvDonations.to")} defaultValue={period.to} />
        </span>
        <input name="q" type="search" aria-label={t("flextvDonations.donorSearch")} className={styles.searchInput} placeholder={t("flextvDonations.donorPlaceholder")} defaultValue={nickname} maxLength={RECEIVED_QUERY_MAX} />
        <button type="submit" className={styles.solidPurple}>
          {t("flextvDonations.search")}
        </button>
      </form>

      {sum && (
        <dl className={styles.listStats} aria-label={t("flextvDonations.statsAria")}>
          <div>
            <dt>{t("flextvDonations.statRex")}</dt>
            <dd className={styles.teal}>{formatNumber(sum.amount)} FN</dd>
          </div>
          <div>
            <dt>{t("flextvDonations.statCount")}</dt>
            <dd>{t("flextvDonations.statCountValue", { count: formatNumber(sum.count) })}</dd>
          </div>
        </dl>
      )}
      {sum?.partial && <p className={styles.listStatsNote}>{t("flextvDonations.partialNote")}</p>}
      <p className={styles.listStatsNote}>{t("flextvDonations.sourcesNote")}</p>

      <div className={styles.table}>
        <table>
          <caption className={styles.srOnly}>{t("flextvDonations.caption")}</caption>
          <thead>
            <tr>
              <th scope="col" style={{ width: 176 }}>
                {t("flextvDonations.colTime")}
              </th>
              <th scope="col" style={{ width: 200 }}>
                {t("flextvDonations.colDonor")}
              </th>
              <th scope="col" style={{ width: 130 }}>
                {t("flextvDonations.colRex")}
              </th>
              <th scope="col">{t("flextvDonations.colGift")}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className={styles.empty}>
                  {nickname ? t("flextvDonations.noResults", { query: nickname }) : t("flextvDonations.empty")}
                </td>
              </tr>
            ) : (
              items.map((d) => (
                <tr key={d.id}>
                  <td className={`${styles.muted} ${styles.nowrap}`}>{formatAt(d.at)}</td>
                  <td className={styles.strong}>
                    <span className={styles.ellipsis}>{d.donorNickname}</span>
                  </td>
                  <td className={styles.amount}>{formatNumber(d.rex)} FN</td>
                  <td>
                    <span className={styles.ellipsis}>{d.productName ?? "-"}</span>
                    {!d.counted && <span className={styles.muted}> · {t("flextvDonations.canceled")}</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className={styles.footer}>
          <span className={styles.muted}>{t("flextvDonations.rangeOf", { total: formatNumber(total), first, last })}</span>
          <nav className={styles.pagination} aria-label={t("flextvDonations.pages")}>
            <PageLink to={href({ ...base, page: 1 })} disabled={page === 1} label={t("flextvDonations.firstPage")} text="|<" />
            <PageLink to={href({ ...base, page: page - 1 })} disabled={page === 1} label={t("flextvDonations.prevPage")} text="<" />
            {pages.map((p) =>
              p === page ? (
                <span key={p} className={`${styles.pageButton} ${styles.pageCurrent}`} aria-current="page">
                  {p}
                </span>
              ) : (
                <Link key={p} href={href({ ...base, page: p })} className={styles.pageButton}>
                  {p}
                </Link>
              )
            )}
            <PageLink to={href({ ...base, page: page + 1 })} disabled={page === totalPages} label={t("flextvDonations.nextPage")} text=">" />
            <PageLink to={href({ ...base, page: totalPages })} disabled={page === totalPages} label={t("flextvDonations.lastPage")} text=">|" />
          </nav>
        </div>
      </div>
    </div>
  );
}
