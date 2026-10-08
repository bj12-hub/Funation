"use client";

import { PageError } from "@/components/layout/PageError";

/** ERROR state for the stand-alone chat windows (팝아웃 · 매니저 채팅창). */
export default function PopoutError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError title="채팅창을 불러오지 못했어요" onRetry={reset} />;
}
