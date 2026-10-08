"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PERIOD_LABEL, presetRange, type Period, type PeriodPreset } from "@/lib/period";
import styles from "./wallet.module.css";

const PRESETS = Object.keys(PERIOD_LABEL) as PeriodPreset[];

type Category = { key: string; label: string };

/**
 * Figma 640:2 / 632:4 filter row: (후원 유형) · 일별/주별/월별/연별/기간별 · dates · 조회.
 * Picking a preset fills the dates; editing a date switches to 기간별. 조회 applies the filter via the URL.
 */
export function HistoryFilter({
  basePath,
  period,
  categories,
  category
}: {
  basePath: string;
  period: Period;
  categories?: Category[];
  category?: string;
}) {
  const router = useRouter();
  const [preset, setPreset] = useState(period.preset);
  const [from, setFrom] = useState(period.from);
  const [to, setTo] = useState(period.to);
  const invalid = !from || !to || from > to;

  const go = (next: { preset: PeriodPreset; from: string; to: string; category?: string }) => {
    const params = new URLSearchParams();
    if (next.category) params.set("type", next.category);
    if (next.preset !== "month") params.set("period", next.preset);
    if (next.preset === "range") {
      params.set("from", next.from);
      params.set("to", next.to);
    }
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  };

  const pickPreset = (p: PeriodPreset) => {
    setPreset(p);
    if (p !== "range") {
      const range = presetRange(p);
      setFrom(range.from);
      setTo(range.to);
    }
  };

  return (
    <form
      className={styles.filter}
      onSubmit={(e) => {
        e.preventDefault();
        if (!invalid) go({ preset, from, to, category });
      }}
    >
      {categories && (
        <div className={styles.segment} role="radiogroup" aria-label="후원 유형">
          {categories.map((c) => (
            <button
              key={c.key}
              type="button"
              role="radio"
              aria-checked={c.key === category}
              className={`${styles.segmentItem} ${c.key === category ? styles.segmentActive : ""}`}
              // Switching the type applies right away with the period currently shown.
              onClick={() => go({ ...period, category: c.key })}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      <div className={styles.segment} role="radiogroup" aria-label="조회 기간">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={p === preset}
            className={`${styles.segmentItem} ${p === preset ? styles.segmentActive : ""}`}
            onClick={() => pickPreset(p)}
          >
            {PERIOD_LABEL[p]}
          </button>
        ))}
      </div>

      <div className={styles.dates}>
        <input
          type="date"
          aria-label="시작일"
          className={styles.dateInput}
          value={from}
          max={to || undefined}
          onChange={(e) => {
            setFrom(e.target.value);
            setPreset("range");
          }}
        />
        <span aria-hidden="true">~</span>
        <input
          type="date"
          aria-label="종료일"
          className={styles.dateInput}
          value={to}
          min={from || undefined}
          onChange={(e) => {
            setTo(e.target.value);
            setPreset("range");
          }}
        />
      </div>

      <button type="submit" className={styles.searchButton} disabled={invalid}>
        조회
      </button>
    </form>
  );
}
