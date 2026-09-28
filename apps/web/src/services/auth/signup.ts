import { USE_MOCK, mockDelay } from "@/lib/mock";

/** Sign-up contract. Duplicate checks are advisory; the server re-checks on submit. */

export type AvailabilityResult = { available: boolean };

export type SignupRequest = {
  email: string;
  password: string;
  nickname: string;
  phoneVerificationToken: string;
  agreements: { youth: true; service: true; privacy: true; marketing: boolean };
};

export type SignupResult = { status: "CREATED" } | { status: "EMAIL_TAKEN" } | { status: "NICKNAME_TAKEN" };

// Values used in the Figma error frames (722:765, 722:1059) are treated as taken in the mock.
const TAKEN_EMAILS = new Set(["hello@funation.kr"]);
const TAKEN_NICKNAMES = new Set(["funation"]);

export async function checkEmailAvailability(email: string): Promise<AvailabilityResult> {
  if (!USE_MOCK) throw new Error("Sign-up API is not connected yet.");
  await mockDelay(300);
  return { available: !TAKEN_EMAILS.has(email.trim().toLowerCase()) };
}

export async function checkNicknameAvailability(nickname: string): Promise<AvailabilityResult> {
  if (!USE_MOCK) throw new Error("Sign-up API is not connected yet.");
  await mockDelay(300);
  return { available: !TAKEN_NICKNAMES.has(nickname.trim().toLowerCase()) };
}

export async function signup(request: SignupRequest): Promise<SignupResult> {
  if (!USE_MOCK) throw new Error("Sign-up API is not connected yet.");
  await mockDelay();
  if (TAKEN_EMAILS.has(request.email.toLowerCase())) return { status: "EMAIL_TAKEN" };
  if (TAKEN_NICKNAMES.has(request.nickname.toLowerCase())) return { status: "NICKNAME_TAKEN" };
  return { status: "CREATED" };
}
