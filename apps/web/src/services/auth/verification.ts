"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import type { SendCodeResult, VerifyCodeResult } from "./verificationTypes";

/**
 * Phone verification contract, shared by sign-up and password reset (Server Actions, so the mock
 * rules never ship to the browser). TBD: SMS provider, send rate limits, attempt limits.
 */

type Purpose = "SIGNUP" | "PASSWORD_RESET";

const isPhone = (v: unknown): v is string => typeof v === "string" && /^01[016789]-\d{3,4}-\d{4}$/.test(v);

export async function sendPhoneCode(phone: string, purpose: Purpose): Promise<SendCodeResult> {
  if (!USE_MOCK) throw new Error("Verification API is not connected yet.");
  if (!isPhone(phone) || (purpose !== "SIGNUP" && purpose !== "PASSWORD_RESET")) return { status: "PHONE_NOT_FOUND" };
  await mockDelay();
  // Mock: for password reset, only 010-1234-5678 is a registered number.
  if (purpose === "PASSWORD_RESET" && phone !== "010-1234-5678") return { status: "PHONE_NOT_FOUND" };
  return { status: "SENT" };
}

export async function verifyPhoneCode(phone: string, code: string): Promise<VerifyCodeResult> {
  if (!USE_MOCK) throw new Error("Verification API is not connected yet.");
  if (!isPhone(phone) || typeof code !== "string") return { status: "INVALID_OR_EXPIRED" };
  await mockDelay();
  // Mock: the correct code is always 123456.
  return code === "123456" ? { status: "VERIFIED", verificationToken: `mock-${phone}` } : { status: "INVALID_OR_EXPIRED" };
}
