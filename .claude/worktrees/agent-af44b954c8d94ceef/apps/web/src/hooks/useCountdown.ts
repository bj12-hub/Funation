"use client";

import { useCallback, useEffect, useState } from "react";

/** Counts down in seconds. Used for verification-code expiry (Figma 03:00 timer). */
export function useCountdown() {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (remaining === null || remaining <= 0) return;
    const timer = setTimeout(() => setRemaining((r) => (r === null ? r : r - 1)), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  const start = useCallback((seconds: number) => setRemaining(seconds), []);
  const stop = useCallback(() => setRemaining(null), []);

  const label =
    remaining === null
      ? null
      : `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;

  return { remaining, label, expired: remaining === 0, start, stop };
}
