"use client";

import { PageError } from "@/components/layout/PageError";

/** ERROR state for favorites. */
export default function FavoritesError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError title="즐겨찾기를 불러오지 못했습니다" onRetry={reset} />;
}
