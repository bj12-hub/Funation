"use client";

import { useEffect, useRef } from "react";

/**
 * 오버레이 새로고침 (리모컨): reloads the page when the server's `reloadSeq` changes after the first
 * render — OBS keeps browser sources open for hours, so this is how a stuck overlay is refreshed remotely.
 */
export function useReloadSignal(reloadSeq: number) {
  const first = useRef<number | null>(null);
  useEffect(() => {
    if (first.current === null) {
      first.current = reloadSeq;
      return;
    }
    if (reloadSeq !== first.current) window.location.reload();
  }, [reloadSeq]);
}
