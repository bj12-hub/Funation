import { USE_MOCK, mockDelay } from "@/lib/mock";

/** Password reset contract (email link or phone verification). */

export type SendResetEmailResult = { status: "SENT" } | { status: "EMAIL_NOT_FOUND" };

export async function sendPasswordResetEmail(email: string): Promise<SendResetEmailResult> {
  if (!USE_MOCK) throw new Error("Password reset API is not connected yet.");
  await mockDelay();
  // Mock: only this address is registered.
  return email.trim().toLowerCase() === "user@funation.kr" ? { status: "SENT" } : { status: "EMAIL_NOT_FOUND" };
}

export async function resetPassword(verificationToken: string, newPassword: string): Promise<{ status: "RESET" }> {
  if (!USE_MOCK) throw new Error("Password reset API is not connected yet.");
  void verificationToken;
  void newPassword;
  await mockDelay();
  return { status: "RESET" };
}
