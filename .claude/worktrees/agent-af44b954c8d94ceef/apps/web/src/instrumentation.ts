/**
 * Server start-up hook (Next.js instrumentation). The service's business day is Korea time: the mock services
 * compute 오늘 · 이번 주 · 기간 filters with `Date` in server time, so the Node server is pinned to Asia/Seoul
 * (no DST) whatever the host's zone is — a UTC host would otherwise start every day 9 hours late.
 * TBD: the real backend owns these boundaries.
 */
export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") process.env.TZ = "Asia/Seoul";
}
