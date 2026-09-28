/**
 * History period filter (일별 · 주별 · 월별 · 연별 · 기간별), Figma 640:2 / 632:4.
 * Shared by the server (URL parsing) and the client filter; no server-only imports here.
 */

export type PeriodPreset = "day" | "week" | "month" | "year" | "range";

export const PERIOD_LABEL: Record<PeriodPreset, string> = {
  day: "일별",
  week: "주별",
  month: "월별",
  year: "연별",
  range: "기간별"
};

export type Period = { preset: PeriodPreset; from: string; to: string };

/** Max span of a custom range; keeps queries bounded. */
const MAX_RANGE_DAYS = 366;

/**
 * Presets end today: 일별 = today, 주별 = last 7 days, 월별 = last month, 연별 = last year.
 * (Assumption — Figma only shows the control with 월별 selected.)
 */
export function presetRange(preset: Exclude<PeriodPreset, "range">, today = new Date()) {
  const from = new Date(today);
  if (preset === "week") from.setDate(from.getDate() - 6);
  if (preset === "month") {
    from.setMonth(from.getMonth() - 1);
    from.setDate(from.getDate() + 1);
  }
  if (preset === "year") {
    from.setFullYear(from.getFullYear() - 1);
    from.setDate(from.getDate() + 1);
  }
  return { from: toDateString(from), to: toDateString(today) };
}

/** Validates URL params; falls back to 월별. */
export function parsePeriod(raw: { period?: string; from?: string; to?: string }): Period {
  const preset = raw.period && raw.period in PERIOD_LABEL ? (raw.period as PeriodPreset) : "month";
  if (preset !== "range") return { preset, ...presetRange(preset) };
  const from = parseDate(raw.from);
  const to = parseDate(raw.to);
  if (!from || !to || from > to || daysBetween(from, to) > MAX_RANGE_DAYS) return { preset: "month", ...presetRange("month") };
  return { preset, from, to };
}

export function toDateString(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) || toDateString(d) !== value ? null : value;
}

function daysBetween(from: string, to: string) {
  return Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86_400_000);
}

