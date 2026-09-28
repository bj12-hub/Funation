import { USE_MOCK, mockDelay } from "@/lib/mock";

/**
 * Phone verification contract, shared by sign-up and password reset.
 * Code length (6) and expiry (3 minutes) follow the Figma screens (13:63).
 */
export const CODE_LENGTH = 6;
export const CODE_TTL_SECONDS = 180;

export type SendCodeResult = { status: "SENT" } | { status: "PHONE_NOT_FOUND" };
export type VerifyCodeResult = { status: "VERIFIED"; verificationToken: string } | { status: "INVALID_OR_EXPIRED" };

type Purpose = "SIGNUP" | "PASSWORD_RESET";

export async function sendPhoneCode(phone: string, purpose: Purpose): Promise<SendCodeResult> {
  if (!USE_MOCK) throw new Error("Verification API is not connected yet.");
  await mockDelay();
  // Mock: for password reset, only 010-1234-5678 is a registered number.
  if (purpose === "PASSWORD_RESET" && phone !== "010-1234-5678") return { status: "PHONE_NOT_FOUND" };
  return { status: "SENT" };
}

export async function verifyPhoneCode(phone: string, code: string): Promise<VerifyCodeResult> {
  if (!USE_MOCK) throw new Error("Verification API is not connected yet.");
  await mockDelay();
  // Mock: the correct code is always 123456.
  return code === "123456" ? { status: "VERIFIED", verificationToken: `mock-${phone}` } : { status: "INVALID_OR_EXPIRED" };
}
