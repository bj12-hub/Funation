"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect } from "react";

/** Seconds before an overlay tries again on its own (nobody can press a button inside OBS). */
const RETRY_SEC = 5;

/**
 * ERROR state for OBS overlays: the broadcast shows nothing (never an error page over the stream) and the
 * overlay reloads its data by itself after a few seconds.
 */
export default function OverlayError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => {
      startTransition(() => {
        router.refresh();
        reset();
      });
    }, RETRY_SEC * 1000);
    return () => clearTimeout(t);
  }, [router, reset]);
  return null;
}
