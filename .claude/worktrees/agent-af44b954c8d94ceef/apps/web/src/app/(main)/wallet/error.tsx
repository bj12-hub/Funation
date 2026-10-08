"use client";

import { PageError } from "@/components/layout/PageError";

/** ERROR state for the FN history pages. */
export default function WalletError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError title="FN 내역을 불러오지 못했습니다" onRetry={reset} />;
}
