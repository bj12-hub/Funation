"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { isValidPassword } from "@/lib/validation";

/** Password reset contract (email link or phone verification). */

export type SendResetEmailResult = { status: "SENT" } | { status: "EMAIL_NOT_FOUND" };

export async function sendPasswordResetEmail(email: string): Promise<SendResetEmailResult> {
  if (!USE_MOCK) throw new Error("Password reset API is not connected yet.");
  await mockDelay();
  // Mock: only this address is registered.
  if (typeof email !== "string") return { status: "EMAIL_NOT_FOUND" };
  return email.trim().toLowerCase() === "user@funation.kr" ? { status: "SENT" } : { status: "EMAIL_NOT_FOUND" };
}

export async function resetPassword(verificationToken: string, newPassword: string): Promise<{ status: "RESET" } | { status: "INVALID" }> {
  if (!USE_MOCK) throw new Error("Password reset API is not connected yet.");
  // The server re-checks the form's rule; verification-token validation is TBD with the backend.
  if (typeof verificationToken !== "string" || !verificationToken || typeof newPassword !== "string" || !isValidPassword(newPassword)) {
    return { status: "INVALID" };
  }
  await mockDelay();
  return { status: "RESET" };
}
