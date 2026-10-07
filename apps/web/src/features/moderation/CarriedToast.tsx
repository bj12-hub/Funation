"use client";

import { useCallback, useEffect, useState } from "react";
import { Toast } from "@/components/ui/Toast";

/**
 * A toast that outlives the page that showed it: blocking a post's author from the post page leaves for the board
 * (the post is gone for the member), and the board shows the block toast. Client memory only — a reload drops it.
 */
let carried: string | null = null;

export const carryToast = (message: string) => {
  carried = message;
};

/** Shows the carried toast once, on the page the member was sent to. */
export function CarriedToast() {
  const [toast, setToast] = useState<string | null>(null);
  const clear = useCallback(() => setToast(null), []);
  useEffect(() => {
    const message = carried;
    carried = null;
    if (message) setToast(message);
  }, []);
  return <Toast message={toast} tone="neutral" onDone={clear} />;
}
