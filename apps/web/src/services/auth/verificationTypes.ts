/**
 * Phone verification constants and result types (client-safe). The actions live in ./verification.ts.
 * Code length (6) and expiry (3 minutes, confirmed 2026-10-08) follow the Figma screens (13:63); the server enforces both.
 */
export const CODE_LENGTH = 6;
export const CODE_TTL_SECONDS = 180;

export type VerificationPurpose = "SIGNUP" | "PASSWORD_RESET";

export type SendCodeResult = { status: "SENT" } | { status: "PHONE_NOT_FOUND" };
export type VerifyCodeResult = { status: "VERIFIED"; verificationToken: string } | { status: "INVALID_OR_EXPIRED" };
