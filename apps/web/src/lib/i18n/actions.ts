"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, isLocale } from "./config";

/** Saves the language choice (a preference, not account data; syncing with the account is TBD). */
export async function setLocale(locale: unknown): Promise<{ status: "SAVED" } | { status: "INVALID" }> {
  if (!isLocale(locale)) return { status: "INVALID" };
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return { status: "SAVED" };
}
