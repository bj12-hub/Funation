import type { Locale } from "./config";
import { en } from "./messages/en";
import { ko, type Messages } from "./messages/ko";

const MESSAGES: Record<Locale, Messages> = { ko, en };

export const messagesFor = (locale: Locale): Messages => MESSAGES[locale];

/** "area.key" paths into Messages, e.g. "nav.creators". */
export type MessageKey = { [A in keyof Messages]: `${A & string}.${keyof Messages[A] & string}` }[keyof Messages];

/** Looks up `key` and fills `{name}` placeholders. Falls back to Korean, then to the key itself. */
export function translate(messages: Messages, key: MessageKey, vars?: Record<string, string | number>) {
  const [area, name] = key.split(".") as [keyof Messages, string];
  const table = messages[area] as Record<string, string>;
  const fallback = ko[area] as Record<string, string>;
  const text = table[name] ?? fallback[name] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (m, v: string) => (v in vars ? String(vars[v]) : m)) : text;
}
