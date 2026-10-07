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

/*
 * Calendar periods (2026-10-08 결정 "달력 기준", server time = Asia/Seoul): a week starts on Monday 00:00 and a
 * month on its 1st. Every preset (dashboard, 통계, 후원 리스트, 정산 관리, FN 내역) runs from such a start to today.
 */

/** Monday 00:00 of the week `today` is in. */
export function startOfWeek(today = new Date()) {
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
}

/** The 1st of the month `months − 1` months back: 1 = this month, 3 = this month and the two before, 12 = 1년. */
export function startOfMonths(months: number, today = new Date()) {
  return new Date(today.getFullYear(), today.getMonth() - (months - 1), 1);
}

/**
 * Presets end today: 일별 = today, 주별 = this week from Monday, 월별 = this month from the 1st, 연별 = the 12 calendar
 * months up to this one. (Figma only shows the control with 월별 selected.)
 */
export function presetRange(preset: Exclude<PeriodPreset, "range">, today = new Date()) {
  const from = preset === "week" ? startOfWeek(today) : preset === "month" ? startOfMonths(1, today) : preset === "year" ? startOfMonths(12, today) : today;
  return { from: toDateString(from), to: toDateString(today) };
}

/** Validates URL params; falls back to 월별. */
export function parsePeriod(raw: { period?: string; from?: string; to?: string }): Period {
  const preset = raw.period && Object.hasOwn(PERIOD_LABEL, raw.period) ? (raw.period as PeriodPreset) : "month";
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

/**
 * A real calendar day as `YYYY-MM-DD`. The format check alone is not enough: `new Date("2026-02-30")` rolls
 * over to 3월 2일 instead of failing, so the parsed day must print back as the same string.
 */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00`);
  return !Number.isNaN(d.getTime()) && toDateString(d) === value;
}

/** A real local date and time as `YYYY-MM-DDTHH:mm` (datetime-local inputs), same round-trip check. */
export function isIsoDateTime(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false;
  const [day, time] = value.split("T");
  const [h, m] = time.split(":").map(Number);
  return isIsoDate(day) && h <= 23 && m <= 59;
}

function parseDate(value?: string) {
  return isIsoDate(value) ? value : null;
}

function daysBetween(from: string, to: string) {
  return Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86_400_000);
}

