"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { revokeSession } from "@/lib/session";
import { isValidPassword } from "@/lib/validation";
import { mockCredentials } from "@/services/account/mockStore";
import { isWithdrawn } from "@/services/account/withdrawalCore";
import { clearPasswordFailures, currentAccountKey } from "./loginLockCore";
import { consumeVerificationToken, verifiedPhone } from "./verificationCore";

/** Password reset contract (email link or phone verification). */

export type SendResetEmailResult = { status: "SENT" } | { status: "EMAIL_NOT_FOUND" };

export type ResetPasswordResult =
  | { status: "RESET" }
  /** The new password breaks the rule (8–20 with a letter, a digit and a special character). */
  | { status: "INVALID" }
  /** One of the last 3 passwords (2026-10-08 결정: the same rule as the password change). */
  | { status: "REUSED" }
  /** The phone verification is unknown, expired, already used or not for a reset of this account: verify again. */
  | { status: "VERIFICATION_EXPIRED" };

export async function sendPasswordResetEmail(email: string): Promise<SendResetEmailResult> {
  if (!USE_MOCK) throw new Error("Password reset API is not connected yet.");
  await mockDelay();
  // Mock: only this address is registered.
  if (typeof email !== "string") return { status: "EMAIL_NOT_FOUND" };
  return email.trim().toLowerCase() === "user@ssumnation.kr" ? { status: "SENT" } : { status: "EMAIL_NOT_FOUND" };
}

/**
 * Sets the new password for the account whose phone was verified (a PASSWORD_RESET token, used up here), lifts
 * the login lock (Figma 718:213: "재설정이 완료되면 다시 로그인할 수 있습니다") and ends the current session, like a
 * password change. The token is checked and used up in the same synchronous step as the write.
 */
export async function resetPassword(verificationToken: string, newPassword: string): Promise<ResetPasswordResult> {
  if (!USE_MOCK) throw new Error("Password reset API is not connected yet.");
  if (typeof verificationToken !== "string" || !verificationToken) return { status: "VERIFICATION_EXPIRED" };
  if (typeof newPassword !== "string" || !isValidPassword(newPassword)) return { status: "INVALID" };
  await mockDelay();
  // Nothing awaits from here to the write. The verification is checked before the reuse rule, so the rule says
  // nothing about the old passwords to someone who did not verify the phone. The mock has one account: the
  // verified phone must still be its number.
  const phone = verifiedPhone(verificationToken, "PASSWORD_RESET");
  if (!phone || phone !== mockCredentials.phone || isWithdrawn()) return { status: "VERIFICATION_EXPIRED" };
  // A refused reuse keeps the verification, so the member can pick another password.
  if (mockCredentials.recentPasswords.includes(newPassword)) return { status: "REUSED" };
  consumeVerificationToken(verificationToken, "PASSWORD_RESET");
  mockCredentials.password = newPassword;
  mockCredentials.recentPasswords = [newPassword, ...mockCredentials.recentPasswords].slice(0, 3);
  mockCredentials.changedAt = new Date().toISOString();
  clearPasswordFailures(currentAccountKey());
  await revokeSession();
  return { status: "RESET" };
}
