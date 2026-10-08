/** Date parts in Korea time. */
function parts(iso: string) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(iso));
  const get = (type: string) => p.find((x) => x.type === type)?.value ?? "";
  return { y: get("year"), m: get("month"), d: get("day"), hh: get("hour"), mm: get("minute") };
}

/** "2026. 09. 12  14:32" — Figma 743:2203 linked-at line. */
export function formatLinkedAt(iso: string) {
  const { y, m, d, hh, mm } = parts(iso);
  return `${y}. ${m}. ${d}  ${hh}:${mm}`;
}

/** "2026. 09. 20. 19:42" — Figma 750:153 완료 일시. */
export function formatDotDateTime(iso: string) {
  const { y, m, d, hh, mm } = parts(iso);
  return `${y}. ${m}. ${d}. ${hh}:${mm}`;
}

/** "1995-01-01" → "1995. 01. 01." — Figma 750:153 생년월일 (a calendar date, no time zone). */
export function formatDotDate(date: string) {
  const [y, m, d] = date.slice(0, 10).split("-");
  return `${y}. ${m}. ${d}.`;
}
