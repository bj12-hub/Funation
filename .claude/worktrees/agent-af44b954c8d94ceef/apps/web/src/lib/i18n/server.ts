import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";
import { messagesFor, translate, type MessageKey } from "./translate";

/** Server-only helpers (not a "use server" module): read the locale cookie during rendering. */
export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** `t` for server components. */
export async function getT() {
  const messages = messagesFor(await getLocale());
  return (key: MessageKey, vars?: Record<string, string | number>) => translate(messages, key, vars);
}
