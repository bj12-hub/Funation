"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STATS_PRESET_LABEL, presetPeriod, type StatsPeriod, type StatsPreset } from "@/services/creator/creatorStats";
import styles from "./studio.module.css";

const PRESETS = (Object.keys(STATS_PRESET_LABEL) as StatsPreset[]).filter((p) => p !== "range");

/**
 * Figma 287:16 — 오늘/1주일/1개월/3개월/6개월/1년 chips, date range, 조회.
 * A chip applies right away; editing a date switches to a custom range applied with 조회.
 */
export function StatsFilter({ period }: { period: StatsPeriod }) {
  const router = useRouter();
  const [from, setFrom] = useState(period.from);
  const [to, setTo] = useState(period.to);
  const invalid = !from || !to || from > to;

  const apply = (next: { preset: StatsPreset; from?: string; to?: string }) => {
    const params = new URLSearchParams();
    if (next.preset !== "week") params.set("period", next.preset);
    if (next.preset === "range" && next.from && next.to) {
      params.set("from", next.from);
      params.set("to", next.to);
    }
    const qs = params.toString();
    router.push(qs ? `/creator?${qs}` : "/creator", { scroll: false });
  };

  return (
    <div className={styles.filter}>
      <div className={styles.chips} role="radiogroup" aria-label="조회 기간">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={period.preset === p}
            className={`${styles.chip} ${period.preset === p ? styles.chipOn : ""}`}
            onClick={() => {
              const r = presetPeriod(p as Exclude<StatsPreset, "range">);
              setFrom(r.from);
              setTo(r.to);
              apply({ preset: p });
            }}
          >
            {STATS_PRESET_LABEL[p]}
          </button>
        ))}
      </div>
      <form
        className={styles.range}
        onSubmit={(e) => {
          e.preventDefault();
          if (!invalid) apply({ preset: "range", from, to });
        }}
      >
        <input type="date" aria-label="시작일" className={styles.date} value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        <span aria-hidden="true">~</span>
        <input type="date" aria-label="종료일" className={styles.date} value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        <button type="submit" className={styles.search} disabled={invalid}>
          조회
        </button>
      </form>
    </div>
  );
}
