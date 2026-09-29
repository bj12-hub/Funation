"use client";

import { useRouter } from "next/navigation";
import styles from "./donations.module.css";

/** 연도 선택 dropdown (539:156) — navigates as soon as a year is picked. */
export function YearSelect({ years, value, baseParams }: { years: number[]; value?: number; baseParams: Record<string, string> }) {
  const router = useRouter();
  return (
    <select
      aria-label="연도 선택"
      className={`${styles.chip} ${styles.select} ${value ? styles.chipOn : ""}`}
      value={value ?? ""}
      onChange={(e) => {
        if (!e.target.value) return;
        const sp = new URLSearchParams({ ...baseParams, period: "year", year: e.target.value });
        if (sp.get("status") === "ALL") sp.delete("status");
        if (!sp.get("q")) sp.delete("q");
        router.push(`/creator/donations?${sp}`);
      }}
    >
      <option value="">연도 선택</option>
      {years.map((y) => (
        <option key={y} value={y}>
          {y}년
        </option>
      ))}
    </select>
  );
}
