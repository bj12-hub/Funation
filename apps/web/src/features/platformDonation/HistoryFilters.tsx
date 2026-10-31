"use client";

import { useRef } from "react";
import { SearchIcon } from "@/components/icons";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { HISTORY_PERIODS, HISTORY_SORTS, HISTORY_STATUS_LABEL, type HistoryPeriod, type HistorySort, type HistoryStatus, type HistoryTab } from "@/services/platformDonation/platformTypes";
import { HISTORY_PERIOD_KEY, HISTORY_SORT_KEY, HISTORY_STATUS_KEY } from "./words";
import styles from "./history.module.css";

/** 기간 · 상태 filters, 정렬 (code-first) and 검색 (817:8038). A plain GET form: selects submit on change. */
export function HistoryFilters({ tab, period, status, q, sort }: { tab: HistoryTab; period: HistoryPeriod; status: HistoryStatus | "all"; q: string; sort: HistorySort }) {
  const { t } = useI18n();
  const ref = useRef<HTMLFormElement>(null);
  const submit = () => ref.current?.requestSubmit();
  return (
    <form ref={ref} className={styles.filters} action="/donation/history" role="search">
      <input type="hidden" name="tab" value={tab} />
      <label className={styles.select}>
        <span>{t("platformDonation.period")}</span>
        <select name="period" defaultValue={period} onChange={submit}>
          {HISTORY_PERIODS.map((p) => (
            <option key={p.key} value={p.key}>
              {t(HISTORY_PERIOD_KEY[p.key])}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.select}>
        <span>{t("platformDonation.status")}</span>
        <select name="status" defaultValue={status} onChange={submit}>
          <option value="all">{t("platformDonation.all")}</option>
          {(Object.keys(HISTORY_STATUS_LABEL) as HistoryStatus[]).map((s) => (
            <option key={s} value={s}>
              {t(HISTORY_STATUS_KEY[s])}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.select}>
        <span>{t("platformDonation.sort")}</span>
        <select name="sort" defaultValue={sort} onChange={submit}>
          {HISTORY_SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {t(HISTORY_SORT_KEY[s.key])}
            </option>
          ))}
        </select>
      </label>
      <span className={styles.searchBox}>
        <SearchIcon className={styles.searchIcon} aria-hidden="true" />
        <input name="q" defaultValue={q} placeholder={t("platformDonation.historySearch")} aria-label={t("platformDonation.historySearch")} maxLength={40} />
      </span>
    </form>
  );
}
