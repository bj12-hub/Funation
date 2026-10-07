"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { mockCredentials } from "@/services/account/mockStore";
import { isWithdrawn } from "@/services/account/withdrawalCore";
import { recordSentCode, verifySentCode } from "./verificationCore";
import type { SendCodeResult, VerificationPurpose, VerifyCodeResult } from "./verificationTypes";

/**
 * Phone verification contract, shared by sign-up and password reset (Server Actions, so the mock
 * rules never ship to the browser). The sent codes and verified tokens live in ./verificationCore.ts:
 * a code works only for the phone and purpose it was sent for, within 3 minutes and 5 wrong tries, and
 * the token it gives is single-use. TBD: SMS provider, send rate limits.
 */

const isPhone = (v: unknown): v is string => typeof v === "string" && /^01[016789]-\d{3,4}-\d{4}$/.test(v);
const isPurpose = (v: unknown): v is VerificationPurpose => v === "SIGNUP" || v === "PASSWORD_RESET";

export async function sendPhoneCode(phone: string, purpose: VerificationPurpose): Promise<SendCodeResult> {
  if (!USE_MOCK) throw new Error("Verification API is not connected yet.");
  if (!isPhone(phone) || !isPurpose(purpose)) return { status: "PHONE_NOT_FOUND" };
  await mockDelay();
  // Mock: for password reset, only the number of the (not withdrawn) account slot is registered.
  if (purpose === "PASSWORD_RESET" && (phone !== mockCredentials.phone || isWithdrawn())) return { status: "PHONE_NOT_FOUND" };
  // Mock SMS: the code is always 123456.
  recordSentCode(phone, purpose);
  return { status: "SENT" };
}

export async function verifyPhoneCode(phone: string, purpose: VerificationPurpose, code: string): Promise<VerifyCodeResult> {
  if (!USE_MOCK) throw new Error("Verification API is not connected yet.");
  if (!isPhone(phone) || !isPurpose(purpose) || typeof code !== "string") return { status: "INVALID_OR_EXPIRED" };
  await mockDelay();
  const verificationToken = verifySentCode(phone, purpose, code);
  return verificationToken ? { status: "VERIFIED", verificationToken } : { status: "INVALID_OR_EXPIRED" };
}
