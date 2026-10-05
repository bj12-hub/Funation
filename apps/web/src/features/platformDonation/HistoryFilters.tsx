"use client";

import { useRef } from "react";
import { SearchIcon } from "@/components/icons";
import { HISTORY_PERIODS, HISTORY_SORTS, HISTORY_STATUS_LABEL, type HistoryPeriod, type HistorySort, type HistoryStatus, type HistoryTab } from "@/services/platformDonation/platformTypes";
import styles from "./history.module.css";

/** 기간 · 상태 filters, 정렬 (code-first) and 검색 (817:8038). A plain GET form: selects submit on change. */
export function HistoryFilters({ tab, period, status, q, sort }: { tab: HistoryTab; period: HistoryPeriod; status: HistoryStatus | "all"; q: string; sort: HistorySort }) {
  const ref = useRef<HTMLFormElement>(null);
  const submit = () => ref.current?.requestSubmit();
  return (
    <form ref={ref} className={styles.filters} action="/donation/history" role="search">
      <input type="hidden" name="tab" value={tab} />
      <label className={styles.select}>
        <span>기간</span>
        <select name="period" defaultValue={period} onChange={submit}>
          {HISTORY_PERIODS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.select}>
        <span>상태</span>
        <select name="status" defaultValue={status} onChange={submit}>
          <option value="all">전체</option>
          {(Object.keys(HISTORY_STATUS_LABEL) as HistoryStatus[]).map((s) => (
            <option key={s} value={s}>
              {HISTORY_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.select}>
        <span>정렬</span>
        <select name="sort" defaultValue={sort} onChange={submit}>
          {HISTORY_SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <span className={styles.searchBox}>
        <SearchIcon className={styles.searchIcon} aria-hidden="true" />
        <input name="q" defaultValue={q} placeholder="거래번호 또는 크리에이터 검색" aria-label="거래번호 또는 크리에이터 검색" maxLength={40} />
      </span>
    </form>
  );
}
