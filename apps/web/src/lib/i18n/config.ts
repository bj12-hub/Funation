/**
 * i18n — code-first foundation (no Figma language frames). Locale comes from the `somnation-locale`
 * cookie so the server renders the right language on the first request. Korean is the source language;
 * English covers the shared shell first (header, side menu, footer) and grows screen by screen.
 * 中文 · 日本語 · ภาษาไทย appear in the menu as 준비 중 until translations exist (TBD).
 */
export const LOCALES = ["ko", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ko";
export const LOCALE_COOKIE = "somnation-locale";

export const isLocale = (v: unknown): v is Locale => LOCALES.includes(v as Locale);

/** Language menu entries (Figma 265:242). `ready: false` = shown but not selectable yet. */
export const LANGUAGE_OPTIONS = [
  { code: "ko", flag: "🇰🇷", label: "한국어", ready: true },
  { code: "en", flag: "🇺🇸", label: "ENGLISH", ready: true },
  { code: "zh", flag: "🇨🇳", label: "中文", ready: false },
  { code: "ja", flag: "🇯🇵", label: "日本語", ready: false },
  { code: "th", flag: "🇹🇭", label: "ภาษาไทย", ready: false }
] as const;
