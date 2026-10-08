"use client";

import { useRef, useState } from "react";
import { exportReceivedDonationsCsv } from "@/services/creator/donationManagement";
import type { ListKind, ListPeriod, StatusFilter } from "@/services/creator/donationManagementTypes";
import styles from "./donations.module.css";

/**
 * 후원 리스트 CSV 다운로드 — code-first (no Figma frame). Exports the current filters (all pages);
 * the file is built on the server and saved in the browser.
 */
export function CsvExportButton({ filter }: { filter: { kind: ListKind; period: ListPeriod; status: StatusFilter; query: string } }) {
  const [state, setState] = useState<{ busy: boolean; note: string | null }>({ busy: false, note: null });
  const busy = useRef(false);

  const download = async () => {
    if (busy.current) return;
    busy.current = true;
    setState({ busy: true, note: null });
    try {
      const res = await exportReceivedDonationsCsv({ ...filter, period: { from: filter.period.from, to: filter.period.to } });
      if (res.status !== "OK") {
        setState({ busy: false, note: res.status === "UNAUTHORIZED" ? "로그인이 필요합니다." : "기간을 확인해 주세요." });
        return;
      }
      const url = URL.createObjectURL(new Blob([res.csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
      setState({ busy: false, note: res.truncated ? `최대 ${res.rows.toLocaleString()}건까지 내려받았어요. 기간을 나눠 주세요.` : `${res.rows.toLocaleString()}건을 내려받았어요.` });
    } catch {
      setState({ busy: false, note: "내려받지 못했습니다. 잠시 후 다시 시도해 주세요." });
    } finally {
      busy.current = false;
    }
  };

  return (
    <>
      <button type="button" className={styles.outlineBlue} onClick={download} disabled={state.busy}>
        {state.busy ? "준비 중…" : "CSV 다운로드"}
      </button>
      {state.note && (
        <span className={styles.muted} role="status">
          {state.note}
        </span>
      )}
    </>
  );
}
