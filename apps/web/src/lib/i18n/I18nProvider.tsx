"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { DEFAULT_LOCALE, type Locale } from "./config";
import { messagesFor, translate, type MessageKey } from "./translate";

type I18n = { locale: Locale; t: (key: MessageKey, vars?: Record<string, string | number>) => string };

const I18nContext = createContext<I18n | null>(null);

/** Provides the server-chosen locale to client components (messages are bundled, so only the code is passed). */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const messages = messagesFor(locale);
  const t = useCallback((key: MessageKey, vars?: Record<string, string | number>) => translate(messages, key, vars), [messages]);
  const value = useMemo(() => ({ locale, t }), [locale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** `t` + locale for client components. Outside a provider (tests, isolated renders) it uses Korean. */
export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  const fallback = useMemo<I18n>(() => ({ locale: DEFAULT_LOCALE, t: (key, vars) => translate(messagesFor(DEFAULT_LOCALE), key, vars) }), []);
  return ctx ?? fallback;
}
