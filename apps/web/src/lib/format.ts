/**
 * Compact Korean counts for the home screen (Figma 727:2742).
 *   245000  → "24.5만"
 *   3050000 → "305만"
 *   9800    → "9.8천"
 * The Figma copy mixes units ("19.2천 명" next to "24.5만명"); this always uses 만 from 10,000 up.
 */
export function formatCompactKo(value: number) {
  if (value >= 10_000) return `${trimDecimal(value / 10_000)}만`;
  if (value >= 1_000) return `${trimDecimal(value / 1_000)}천`;
  return String(value);
}

/** 12842 → "12,842" */
export function formatNumber(value: number) {
  return value.toLocaleString("ko-KR");
}

/** 6300 → "01:45:00" (live elapsed time, Figma 617:453) */
export function formatDuration(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

function trimDecimal(value: number) {
  const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return String(rounded);
}

// ── Korea time ──────────────────────────────────────────────────────────────────────────────────────────
// Service time is Asia/Seoul: every date and time a screen shows is Korea time, whatever the viewer's zone (a client
// component formats in the browser) or the server's. Screens format dates only through these helpers, or pass
// `timeZone` themselves (dateFormatGuard.test.ts checks the source).

export const SERVICE_TIME_ZONE = "Asia/Seoul";
const KST_OFFSET_MS = 9 * 3_600_000; // UTC+9, no daylight saving

export type DateInput = string | number | Date;

/** A zone-less server stamp: "2026-10-08", "2026-10-08 14:32", "2026-10-08 14:32:05" or "2026-10-08T14:32". */
const SERVER_STAMP = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2})(:\d{2}(?:\.\d+)?)?)?$/;

/**
 * The instant `value` names. An ISO string with a zone (`…Z`, `…+09:00`), a number or a Date is that instant. A zone-less
 * server stamp is Korea time (the server's zone, instrumentation.ts) — `new Date` would read it in the viewer's zone, and
 * a date alone as UTC.
 */
export function kstInstant(value: DateInput): Date {
  if (typeof value !== "string") return new Date(value);
  const m = SERVER_STAMP.exec(value);
  return m ? new Date(`${m[1]}T${m[2] ?? "00:00"}${m[3] ?? ":00"}+09:00`) : new Date(value);
}

/** `Date#toLocaleString("ko-KR", options)` in Korea time — "2026. 10. 8. 오후 3:04:05" without options. */
export const formatKst = (value: DateInput, options?: Intl.DateTimeFormatOptions) =>
  kstInstant(value).toLocaleString("ko-KR", { ...options, timeZone: SERVICE_TIME_ZONE });

/** `Date#toLocaleDateString("ko-KR", options)` in Korea time — "2026. 10. 8." without options. */
export const formatKstDate = (value: DateInput, options?: Intl.DateTimeFormatOptions) =>
  kstInstant(value).toLocaleDateString("ko-KR", { ...options, timeZone: SERVICE_TIME_ZONE });

/** `Date#toLocaleTimeString("ko-KR", options)` in Korea time — "오후 3:04:05" without options. */
export const formatKstTime = (value: DateInput, options?: Intl.DateTimeFormatOptions) =>
  kstInstant(value).toLocaleTimeString("ko-KR", { ...options, timeZone: SERVICE_TIME_ZONE });

/** Korea-time fields of `value` (month 1–12), for fixed layouts such as "10.8 15:04". */
export function kstParts(value: DateInput) {
  const k = new Date(kstInstant(value).getTime() + KST_OFFSET_MS);
  return { year: k.getUTCFullYear(), month: k.getUTCMonth() + 1, day: k.getUTCDate(), hour: k.getUTCHours(), minute: k.getUTCMinutes(), second: k.getUTCSeconds() };
}

/** "2026-10-08T15:04:05": the Korea-time wall clock of `value`, zone-less, to cut into "2026-10-08" or "2026-10-08 15:04". */
export function kstIsoString(value: DateInput) {
  const p = kstParts(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
}
