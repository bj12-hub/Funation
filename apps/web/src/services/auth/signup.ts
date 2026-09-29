"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { isEmail, isValidNickname, isValidPassword } from "@/lib/validation";

/**
 * Sign-up contract (Server Actions, so the mock rules never ship to the browser). Duplicate checks
 * are advisory; `signup` re-checks formats, required agreements and duplicates on submit.
 * TBD: phone-verification token validation, age rules, account creation on the backend.
 */

export type AvailabilityResult = { available: boolean };

export type SignupRequest = {
  email: string;
  password: string;
  nickname: string;
  phoneVerificationToken: string;
  agreements: { youth: true; service: true; privacy: true; marketing: boolean };
};

export type SignupResult = { status: "CREATED" } | { status: "EMAIL_TAKEN" } | { status: "NICKNAME_TAKEN" } | { status: "INVALID" };

// Values used in the Figma error frames (722:765, 722:1059) are treated as taken in the mock.
const TAKEN_EMAILS = new Set(["hello@funation.kr"]);
const TAKEN_NICKNAMES = new Set(["funation"]);

export async function checkEmailAvailability(email: string): Promise<AvailabilityResult> {
  if (!USE_MOCK) throw new Error("Sign-up API is not connected yet.");
  if (typeof email !== "string" || !isEmail(email)) return { available: false };
  await mockDelay(300);
  return { available: !TAKEN_EMAILS.has(email.trim().toLowerCase()) };
}

export async function checkNicknameAvailability(nickname: string): Promise<AvailabilityResult> {
  if (!USE_MOCK) throw new Error("Sign-up API is not connected yet.");
  if (typeof nickname !== "string" || !isValidNickname(nickname.trim())) return { available: false };
  await mockDelay(300);
  return { available: !TAKEN_NICKNAMES.has(nickname.trim().toLowerCase()) };
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
  if (TAKEN_EMAILS.has(r.email!.trim().toLowerCase())) return { status: "EMAIL_TAKEN" };
  if (TAKEN_NICKNAMES.has(r.nickname!.trim().toLowerCase())) return { status: "NICKNAME_TAKEN" };
  return { status: "CREATED" };
}
