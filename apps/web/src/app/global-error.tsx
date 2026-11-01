"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "@/lib/i18n/config";
import { messagesFor, translate, type MessageKey } from "@/lib/i18n/translate";
import "./globals.css";

const noSubscribe = () => () => {};
/** The language cookie, read in the browser: this page has no provider (2026-11-01). The server render stays Korean. */
const cookieLocale = (): Locale => {
  const value = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${LOCALE_COOKIE}=`))
    ?.slice(LOCALE_COOKIE.length + 1);
  return isLocale(value) ? value : DEFAULT_LOCALE;
};

/**
 * Last-resort boundary for errors in the root layout itself (the normal layout and fonts are gone, so it
 * renders its own document). Keeps the dark tokens and offers a reload.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const locale = useSyncExternalStore(noSubscribe, cookieLocale, () => DEFAULT_LOCALE);
  const t = (key: MessageKey) => translate(messagesFor(locale), key);
  return (
    <html lang={locale} data-theme="dark">
      <body>
        <main role="alert" style={{ display: "flex", minHeight: "100vh", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24, textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: "var(--font-size-24)" }}>{t("page.globalErrorTitle")}</h1>
          <p style={{ margin: 0, color: "var(--color-text-secondary)" }}>{t("page.globalErrorBody")}</p>
          <button type="button" onClick={reset} style={{ padding: "11px 20px", borderRadius: "var(--radius-8)", background: "var(--gradient-primary-button)", color: "var(--color-text-on-accent)", fontWeight: 700 }}>
            {t("page.retry")}
          </button>
        </main>
      </body>
    </html>
  );
}
