"use client";

import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/format";

/**
 * 방송 시간 since `since` (ISO), ticking every second (phase 10). Drawn after mount so the server's and the browser's
 * clocks never disagree; nothing for a time that cannot be read.
 */
export function Elapsed({ since, className, suffix = " 방송 중" }: { since: string; className?: string; suffix?: string }) {
  const start = Date.parse(since);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (now === null || !Number.isFinite(start)) return null;
  return (
    <span className={className}>
      ⏱ {formatDuration((now - start) / 1000)}
      {suffix}
    </span>
  );
}
