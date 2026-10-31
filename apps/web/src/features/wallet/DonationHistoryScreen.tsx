import { formatNumber } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { DONATION_CATEGORY_LABEL, DONATION_QUERY_MAX, type DonationCategory, type DonationFilter, type DonationRecord, type HistoryPage } from "@/services/wallet/walletTypes";
import { DonationTable } from "./DonationTable";
import { HistoryFilter } from "./HistoryFilter";
import { HistoryFooter } from "./HistoryFooter";
import { WalletHistoryShell } from "./WalletHistoryShell";
import { historyQuery } from "./historyParams";
import styles from "./wallet.module.css";

const CATEGORY_KEY: Record<DonationCategory, MessageKey> = { basic: "wallet.categoryBasic", quest: "wallet.categoryQuest", game: "wallet.categoryGame" };
const CATEGORIES = Object.keys(DONATION_CATEGORY_LABEL) as DonationCategory[];

/**
 * Figma 632:4 (data) · 637:214 (empty) — route `/wallet/donations`. The search row (크리에이터명·메시지,
 * 최소 / 최대 FN, 최신순 / 오래된순, 결과 · 합계) follows funnation 내 후원 내역 (code-first).
 */
export async function DonationHistoryScreen({ data, category, filter }: { data: HistoryPage<DonationRecord> & { totalFn: number }; category: DonationCategory; filter: DonationFilter }) {
  const t = await getT();
  const { period } = data;
  return (
    <WalletHistoryShell tab="donations">
      <section className={styles.card} aria-label={t("wallet.donationHistory")}>
        <HistoryFilter
          key={`${category}${period.preset}${period.from}${period.to}`}
          basePath="/wallet/donations"
          period={period}
          categories={CATEGORIES.map((key) => ({ key, label: t(CATEGORY_KEY[key]) }))}
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
          <input type="search" name="q" className={styles.donationSearchInput} placeholder={t("wallet.searchDonations")} aria-label={t("wallet.searchDonations")} defaultValue={filter.q ?? ""} maxLength={DONATION_QUERY_MAX} />
          <input type="number" name="min" min={0} className={styles.donationAmount} placeholder={t("wallet.minFn")} aria-label={t("wallet.minFnLabel")} defaultValue={filter.min ?? ""} />
          <span aria-hidden="true">~</span>
          <input type="number" name="max" min={0} className={styles.donationAmount} placeholder={t("wallet.maxFn")} aria-label={t("wallet.maxFnLabel")} defaultValue={filter.max ?? ""} />
          <select name="sort" className={styles.donationSort} aria-label={t("wallet.sort")} defaultValue={filter.sort ?? "latest"}>
            <option value="latest">{t("wallet.sortLatest")}</option>
            <option value="oldest">{t("wallet.sortOldest")}</option>
          </select>
          <button type="submit" className={styles.donationSearchButton}>
            {t("wallet.search")}
          </button>
        </form>
        <p className={styles.donationSummary}>
          {t("wallet.donationSummary", { count: formatNumber(data.totalCount), total: formatNumber(data.totalFn) })}
        </p>
        <DonationTable items={data.items} t={t} />
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
