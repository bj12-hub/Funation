"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { exportReceivedDonationsCsv } from "@/services/creator/donationManagement";
import type { ListKind, ListPeriod, StatusFilter } from "@/services/creator/donationManagementTypes";
import styles from "./donations.module.css";

/**
 * 후원 리스트 CSV 다운로드 — code-first (no Figma frame). Exports the current filters (all pages);
 * the file is built on the server and saved in the browser.
 */
export function CsvExportButton({ filter }: { filter: { kind: ListKind; period: ListPeriod; status: StatusFilter; query: string } }) {
  const { t } = useI18n();
  const [state, setState] = useState<{ busy: boolean; note: string | null }>({ busy: false, note: null });
  const busy = useRef(false);

  const download = async () => {
    if (busy.current) return;
    busy.current = true;
    setState({ busy: true, note: null });
    try {
      const res = await exportReceivedDonationsCsv({ ...filter, period: { from: filter.period.from, to: filter.period.to } });
      if (res.status !== "OK") {
        setState({ busy: false, note: res.status === "UNAUTHORIZED" ? t("studioDonationsList.loginRequired") : t("studioDonationsList.checkPeriod") });
        return;
      }
      const url = URL.createObjectURL(new Blob([res.csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
      setState({ busy: false, note: res.truncated ? t("studioDonationsList.downloadedMax", { count: res.rows.toLocaleString() }) : t("studioDonationsList.downloaded", { count: res.rows.toLocaleString() }) });
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
