"use client";

import { useRef, useState } from "react";
import { formatNumber } from "@/lib/format";
import { exportImportedDonationsCsv } from "@/services/creator/donationImport";
import type { ImportedFilter } from "@/services/creator/donationImportTypes";
import styles from "./donations.module.css";

/**
 * 가져온 내역 CSV 다운로드 — the current filters, every page (capped, sample value). The file is built on the server,
 * with formula-looking cells escaped.
 */
export function ImportedCsvButton({ filter }: { filter: ImportedFilter }) {
  const [state, setState] = useState<{ busy: boolean; note: string | null }>({ busy: false, note: null });
  const busy = useRef(false);

  const download = async () => {
    if (busy.current) return;
    busy.current = true;
    setState({ busy: true, note: null });
    try {
      const res = await exportImportedDonationsCsv({ source: filter.source, from: filter.from, to: filter.to, q: filter.query });
      if (res.status !== "OK") {
        setState({ busy: false, note: res.status === "UNAUTHORIZED" ? "로그인이 필요합니다." : "조건을 확인해 주세요." });
        return;
      }
      const url = URL.createObjectURL(new Blob([res.csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
      setState({ busy: false, note: res.truncated ? `최대 ${formatNumber(res.rows)}건까지 내려받았어요. 조건을 나눠 주세요.` : `${formatNumber(res.rows)}건을 내려받았어요.` });
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
