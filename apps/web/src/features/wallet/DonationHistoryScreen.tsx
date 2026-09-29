import { formatNumber } from "@/lib/format";
import { DONATION_CATEGORY_LABEL, DONATION_QUERY_MAX, type DonationCategory, type DonationFilter, type DonationRecord, type HistoryPage } from "@/services/wallet/walletTypes";
import { DonationTable } from "./DonationTable";
import { HistoryFilter } from "./HistoryFilter";
import { HistoryFooter } from "./HistoryFooter";
import { WalletHistoryShell } from "./WalletHistoryShell";
import { historyQuery } from "./historyParams";
import styles from "./wallet.module.css";

const CATEGORIES = (Object.keys(DONATION_CATEGORY_LABEL) as DonationCategory[]).map((key) => ({ key, label: DONATION_CATEGORY_LABEL[key] }));

/**
 * Figma 632:4 (data) · 637:214 (empty) — route `/wallet/donations`. The search row (크리에이터명·메시지,
 * 최소 / 최대 FN, 최신순 / 오래된순, 결과 · 합계) follows funnation 내 후원 내역 (code-first).
 */
export function DonationHistoryScreen({ data, category, filter }: { data: HistoryPage<DonationRecord> & { totalFn: number }; category: DonationCategory; filter: DonationFilter }) {
  const { period } = data;
  return (
    <WalletHistoryShell tab="donations">
      <section className={styles.card} aria-label="후원 내역">
        <HistoryFilter
          key={`${category}${period.preset}${period.from}${period.to}`}
          basePath="/wallet/donations"
          period={period}
          categories={CATEGORIES}
          category={category}
        />
        <form role="search" action="/wallet/donations" className={styles.donationSearch}>
          {category !== "basic" && <input type="hidden" name="type" value={category} />}
          {period.preset !== "month" && <input type="hidden" name="period" value={period.preset} />}
          {period.preset === "range" && (
            <>
              <input type="hidden" name="from" value={period.from} />
              <input type="hidden" name="to" value={period.to} />
            </>
          )}
          <input type="search" name="q" className={styles.donationSearchInput} placeholder="크리에이터명·메시지로 검색" aria-label="크리에이터명·메시지로 검색" defaultValue={filter.q ?? ""} maxLength={DONATION_QUERY_MAX} />
          <input type="number" name="min" min={0} className={styles.donationAmount} placeholder="최소 FN" aria-label="최소 금액(FN)" defaultValue={filter.min ?? ""} />
          <span aria-hidden="true">~</span>
          <input type="number" name="max" min={0} className={styles.donationAmount} placeholder="최대 FN" aria-label="최대 금액(FN)" defaultValue={filter.max ?? ""} />
          <select name="sort" className={styles.donationSort} aria-label="정렬" defaultValue={filter.sort ?? "latest"}>
            <option value="latest">최신순</option>
            <option value="oldest">오래된순</option>
          </select>
          <button type="submit" className={styles.donationSearchButton}>
            검색
          </button>
        </form>
        <p className={styles.donationSummary}>
          결과 {formatNumber(data.totalCount)}건 · 합계 {formatNumber(data.totalFn)} FN
        </p>
        <DonationTable items={data.items} />
        <HistoryFooter
          page={data.page}
          totalPages={data.totalPages}
          hrefFor={(page) => `/wallet/donations${historyQuery({ period, category, page, filter })}`}
          csvHref={`/api/wallet/donations${historyQuery({ period, category, filter })}`}
          hasRows={data.totalCount > 0}
        />
      </section>
    </WalletHistoryShell>
  );
}
