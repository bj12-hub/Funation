"use client";

import { useEffect, useState } from "react";

/**
 * Server time each second, corrected for clock skew: `serverNow` is the server's clock when the data was read (a PC
 * running OBS can be minutes off). Null until mounted; with no `serverNow` the browser clock is used as is.
 */
export function useServerClock(serverNow: string | null) {
  const [skew, setSkew] = useState(0);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setSkew(serverNow ? new Date(serverNow).getTime() - Date.now() : 0), [serverNow]);
  useEffect(() => {
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);
  return now === null ? null : now + skew;
}
