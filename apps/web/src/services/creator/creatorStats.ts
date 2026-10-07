/**
 * Creator dashboard period filter (Figma 245:14 · 287:16: 오늘 / 1주일 / 1개월 / 3개월 / 6개월 / 1년 + dates).
 * Client-safe: shared by the server (URL parsing) and the filter UI.
 */
import { isIsoDate, startOfMonths, startOfWeek } from "@/lib/period";

export type StatsPreset = "today" | "week" | "month" | "3months" | "6months" | "year" | "range";

export const STATS_PRESET_LABEL: Record<StatsPreset, string> = {
  today: "오늘",
  week: "1주일",
  month: "1개월",
  "3months": "3개월",
  "6months": "6개월",
  year: "1년",
  range: "기간 설정"
};

export type StatsPeriod = { preset: StatsPreset; from: string; to: string };

const pad = (n: number) => String(n).padStart(2, "0");
export const toIsoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Calendar months per preset (2026-10-08 결정 "달력 기준"); 1주일 starts on Monday, 오늘 is today. */
const PRESET_MONTHS = { month: 1, "3months": 3, "6months": 6, year: 12 } as const;
export const MAX_RANGE_DAYS = 366;

export function presetPeriod(preset: Exclude<StatsPreset, "range">, today = new Date()): StatsPeriod {
  const from = preset === "today" ? today : preset === "week" ? startOfWeek(today) : startOfMonths(PRESET_MONTHS[preset], today);
  return { preset, from: toIsoDate(from), to: toIsoDate(today) };
}

/** Validates `?period=&from=&to=`; falls back to 1주일 (the design's default). */
export function parseStatsPeriod(raw: { period?: string; from?: string; to?: string }): StatsPeriod {
  const preset = raw.period && Object.hasOwn(STATS_PRESET_LABEL, raw.period) ? (raw.period as StatsPreset) : "week";
  if (preset !== "range") return presetPeriod(preset);
  if (!isIsoDate(raw.from) || !isIsoDate(raw.to) || raw.from! > raw.to! || eachDay(raw.from!, raw.to!).length > MAX_RANGE_DAYS) return presetPeriod("week");
  return { preset, from: raw.from!, to: raw.to! };
}

export function eachDay(from: string, to: string) {
  const out: string[] = [];
  const d = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  while (d <= end && out.length <= MAX_RANGE_DAYS) {
    out.push(toIsoDate(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}
