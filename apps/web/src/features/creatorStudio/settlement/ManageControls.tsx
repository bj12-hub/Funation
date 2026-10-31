"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { exportSettlementHistoryCsv, resetSettlementRegistration } from "@/services/creator/settlementManagement";
import { MANAGE_PERIODS, type ManagePeriod } from "@/services/creator/settlementTypes";
import { SettlementNoticeModal } from "./SettlementNoticeModal";
import styles from "./manage.module.css";

const BASE = "/creator/settlement/manage";

/**
 * 기간 filter (478:2 · 479:144). Presets navigate straight away; 기간별 enables the dates and 조회.
 * The server resolves the preset ranges and does the filtering.
 */
export function ManageFilter({ period, from, to }: { period: ManagePeriod; from: string; to: string }) {
  const router = useRouter();
  const [range, setRange] = useState({ from, to });
  const [custom, setCustom] = useState(period === "custom");
  const [pending, startTransition] = useTransition();

  const go = (qs: string) => startTransition(() => router.push(`${BASE}?${qs}`));

  return (
    <form
      className={styles.filter}
      onSubmit={(e) => {
        e.preventDefault();
        go(`period=custom&from=${range.from}&to=${range.to}`);
      }}
    >
      <div className={styles.segment} role="group" aria-label="조회 기간">
        {MANAGE_PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={(custom ? "custom" : period) === p.key}
            onClick={() => {
              if (p.key === "custom") setCustom(true);
              else {
                setCustom(false);
                go(`period=${p.key}`);
              }
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <span className={styles.dates}>
        <input
          type="date"
          className={styles.date}
          value={range.from}
          max={range.to}
          disabled={!custom}
          onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
          aria-label="시작일"
          required
        />
        <span aria-hidden="true">~</span>
        <input
          type="date"
          className={styles.date}
          value={range.to}
          min={range.from}
          disabled={!custom}
          onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
          aria-label="종료일"
          required
        />
      </span>
      <button type="submit" className={styles.search} disabled={!custom || pending} aria-busy={pending || undefined}>
        조회
      </button>
    </form>
  );
}

/**
 * 정산 내역 CSV 다운로드 — code-first (no Figma frame, 2026-11-01): the 조회 기간 on screen, every page; the file is built on
 * the server and saved in the browser.
 */
export function SettlementCsvButton({ period, from, to }: { period: ManagePeriod; from: string; to: string }) {
  const [state, setState] = useState<{ busy: boolean; note: string | null }>({ busy: false, note: null });
  const busy = useRef(false);
  const download = async () => {
    if (busy.current) return;
    busy.current = true;
    setState({ busy: true, note: null });
    try {
      const res = await exportSettlementHistoryCsv({ period, from, to });
      if (res.status !== "OK") {
        setState({ busy: false, note: res.status === "UNAUTHORIZED" ? "로그인이 필요합니다." : "정산 정보를 먼저 등록해 주세요." });
        return;
      }
      const url = URL.createObjectURL(new Blob([res.csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
      setState({ busy: false, note: `${res.rows.toLocaleString("ko-KR")}건을 내려받았어요.` });
    } catch {
      setState({ busy: false, note: "내려받지 못했습니다. 잠시 후 다시 시도해 주세요." });
    } finally {
      busy.current = false;
    }
  };
  return (
    <div className={styles.csvRow}>
      {state.note && (
        <span className={styles.csvNote} role="status">
          {state.note}
        </span>
      )}
      <button type="button" className={styles.search} onClick={download} disabled={state.busy} aria-busy={state.busy || undefined}>
        {state.busy ? "준비 중…" : "CSV 다운로드"}
      </button>
    </div>
  );
}

/** 정보 변경 → 480:2 confirm → 변경하기 removes the registration and restarts 정산 등록. */
export function ChangeInfoButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const change = () => {
    setError(null);
    startTransition(async () => {
      const res = await resetSettlementRegistration();
      if (res.status === "RESET" || res.status === "NOT_REGISTERED") router.push("/creator/settlement/register");
      else if (res.status === "UNAUTHORIZED") router.push(`/login?role=creator&next=${BASE}`);
      else setError("변경하지 못했어요. 다시 시도해 주세요.");
    });
  };

  return (
    <>
      <button type="button" className={styles.changeButton} onClick={() => setOpen(true)} aria-haspopup="dialog">
        정보 변경
      </button>
      <SettlementNoticeModal
        open={open}
        onClose={() => setOpen(false)}
        title="정산 정보 변경"
        width={420}
        lines={["현재의 정보는 삭제되며,", "정산 정보 재등록이 진행됩니다.", "", "정말로 변경하시겠습니까?", ...(error ? [error] : [])]}
        action={
          <button type="button" className={styles.dangerButton} onClick={change} disabled={pending} aria-busy={pending || undefined}>
            {pending ? "처리 중..." : "변경하기"}
          </button>
        }
      />
    </>
  );
}
