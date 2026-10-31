"use client";

import { useRef, useState } from "react";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { exportImportedDonationsCsv } from "@/services/creator/donationImport";
import type { ImportedFilter } from "@/services/creator/donationImportTypes";
import styles from "./donations.module.css";

/**
 * 가져온 내역 CSV 다운로드 — the current filters, every page (capped, sample value). The file is built on the server,
 * with formula-looking cells escaped.
 */
export function ImportedCsvButton({ filter }: { filter: ImportedFilter }) {
  const { t } = useI18n();
  const [state, setState] = useState<{ busy: boolean; note: string | null }>({ busy: false, note: null });
  const busy = useRef(false);

  const download = async () => {
    if (busy.current) return;
    busy.current = true;
    setState({ busy: true, note: null });
    try {
      const res = await exportImportedDonationsCsv({ source: filter.source, from: filter.from, to: filter.to, q: filter.query });
      if (res.status !== "OK") {
        setState({ busy: false, note: res.status === "UNAUTHORIZED" ? t("studioDonationsList.loginRequired") : t("studioDonationsImport.checkFilters") });
        return;
      }
      const url = URL.createObjectURL(new Blob([res.csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
      setState({ busy: false, note: res.truncated ? t("studioDonationsImport.downloadedMax", { count: formatNumber(res.rows) }) : t("studioDonationsList.downloaded", { count: formatNumber(res.rows) }) });
    } catch {
      setState({ busy: false, note: t("studioDonationsList.downloadFailed") });
    } finally {
      busy.current = false;
    }
  };

  return (
    <>
      <button type="button" className={styles.outlineBlue} onClick={download} disabled={state.busy}>
        {state.busy ? t("studioDonationsList.preparing") : t("studioDonationsList.downloadCsv")}
      </button>
      {state.note && (
        <span className={styles.muted} role="status">
          {state.note}
        </span>
      )}
    </>
  );
}
