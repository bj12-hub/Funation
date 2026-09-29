/**
 * Phone verification constants and result types (client-safe). The actions live in ./verification.ts.
 * Code length (6) and expiry (3 minutes) follow the Figma screens (13:63).
 */
export const CODE_LENGTH = 6;
export const CODE_TTL_SECONDS = 180;

export type SendCodeResult = { status: "SENT" } | { status: "PHONE_NOT_FOUND" };
export type VerifyCodeResult = { status: "VERIFIED"; verificationToken: string } | { status: "INVALID_OR_EXPIRED" };
