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
