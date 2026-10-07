"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { isEmail, isValidNickname, isValidPassword } from "@/lib/validation";
import { judgeNickname, nicknamesTakenForSignup } from "@/services/account/nicknameRules";
import { startNewAccount } from "@/services/account/rejoin";
import { consumeVerificationToken } from "./verificationCore";

/**
 * Sign-up contract (Server Actions, so the mock rules never ship to the browser). Duplicate checks
 * are advisory; `signup` re-checks formats, required agreements and duplicates on submit, and uses up
 * the phone verification (a SIGNUP token from ./verification.ts, single-use) with the account write.
 * TBD: age rules, account creation on the backend.
 * A withdrawn member can sign up again right away (2026-10-05 결정) as a new account — nothing is restored.
 */

/** `reason` (nickname only) tells a forbidden name from a taken one, so the form can say which. */
export type AvailabilityResult = { available: boolean; reason?: "INVALID" | "FORBIDDEN" | "DUPLICATE" };

export type SignupRequest = {
  email: string;
  password: string;
  nickname: string;
  phoneVerificationToken: string;
  agreements: { youth: true; service: true; privacy: true; marketing: boolean };
};

export type SignupResult =
  | { status: "CREATED" }
  | { status: "EMAIL_TAKEN" }
  | { status: "NICKNAME_TAKEN" }
  /** The phone verification is unknown, expired, already used or for another purpose: verify again. */
  | { status: "VERIFICATION_EXPIRED" }
  | { status: "INVALID" };

// Values used in the Figma error frames (722:765, 722:1059) are treated as taken in the mock.
const TAKEN_EMAILS = new Set(["hello@funation.kr"]);

export async function checkEmailAvailability(email: string): Promise<AvailabilityResult> {
  if (!USE_MOCK) throw new Error("Sign-up API is not connected yet.");
  if (typeof email !== "string" || !isEmail(email)) return { available: false };
  await mockDelay(300);
  return { available: !TAKEN_EMAILS.has(email.trim().toLowerCase()) };
}

/** The member nickname rules of 마이페이지 (services/account/nicknameRules.ts). */
export async function checkNicknameAvailability(nickname: string): Promise<AvailabilityResult> {
  if (!USE_MOCK) throw new Error("Sign-up API is not connected yet.");
  if (typeof nickname !== "string" || !isValidNickname(nickname.trim())) return { available: false, reason: "INVALID" };
  await mockDelay(300);
  const verdict = judgeNickname(nickname.trim(), await nicknamesTakenForSignup());
  return verdict === "AVAILABLE" ? { available: true } : { available: false, reason: verdict };
}

export async function signup(request: SignupRequest): Promise<SignupResult> {
  if (!USE_MOCK) throw new Error("Sign-up API is not connected yet.");
  const r = (typeof request === "object" && request !== null ? request : {}) as Partial<SignupRequest>;
  const a = r.agreements;
  const valid =
    typeof r.email === "string" &&
    isEmail(r.email) &&
    typeof r.password === "string" &&
    isValidPassword(r.password) &&
    typeof r.nickname === "string" &&
    isValidNickname(r.nickname.trim()) &&
    typeof r.phoneVerificationToken === "string" &&
    r.phoneVerificationToken.length > 0 &&
    !!a &&
    a.youth === true &&
    a.service === true &&
    a.privacy === true &&
    typeof a.marketing === "boolean";
  if (!valid) return { status: "INVALID" };
  await mockDelay();
  const takenNicknames = await nicknamesTakenForSignup();
  // From here to the write nothing awaits.
  if (TAKEN_EMAILS.has(r.email!.trim().toLowerCase())) return { status: "EMAIL_TAKEN" };
  const nickname = judgeNickname(r.nickname!.trim(), takenNicknames);
  if (nickname === "DUPLICATE") return { status: "NICKNAME_TAKEN" };
  // A forbidden word or 익명: the form's availability check says why; the submit only refuses.
  if (nickname !== "AVAILABLE") return { status: "INVALID" };
  // The verification is used up only together with the account write, so a refused sign-up keeps it.
  const phone = consumeVerificationToken(r.phoneVerificationToken, "SIGNUP");
  if (!phone) return { status: "VERIFICATION_EXPIRED" };
  // The mock has one account slot: after a withdrawal it becomes the new account.
  startNewAccount({ nickname: r.nickname!.trim(), password: r.password!, marketing: a!.marketing, phone });
  return { status: "CREATED" };
}
