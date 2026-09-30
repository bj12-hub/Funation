"use client";

import "./globals.css";

/**
 * Last-resort boundary for errors in the root layout itself (the normal layout and fonts are gone, so it
 * renders its own document). Keeps the dark tokens and offers a reload.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ko" data-theme="dark">
      <body>
        <main role="alert" style={{ display: "flex", minHeight: "100vh", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24, textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: "var(--font-size-24)" }}>일시적인 오류가 발생했어요</h1>
          <p style={{ margin: 0, color: "var(--color-text-secondary)" }}>잠시 후 다시 시도해 주세요.</p>
          <button type="button" onClick={reset} style={{ padding: "11px 20px", borderRadius: "var(--radius-8)", background: "var(--gradient-primary-button)", color: "var(--color-text-on-accent)", fontWeight: 700 }}>
            다시 시도
          </button>
        </main>
      </body>
    </html>
  );
}
