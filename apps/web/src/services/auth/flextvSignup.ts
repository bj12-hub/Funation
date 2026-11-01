"use server";

import { cookies } from "next/headers";
import {
  checkLoginId,
  checkNickname,
  sessionFromMember,
  signIn,
  signInWithProvider,
  signUp,
  signUpWithProvider,
  type SignUpOutcome
} from "@/lib/flextv/auth";
import { FLEXTV_AUTH } from "@/lib/flextv/mode";
import { requestDeviceContext } from "@/lib/flextv/request";
import { hasReservedLoginWord, isFlextvLoginId, isFlextvNickname, isFlextvPassword } from "@/lib/flextv/rules";
import { SOCIAL_SIGNUP_COOKIE, decodeSocialSignup } from "@/lib/flextv/social";
import { safeRedirectPath } from "@/lib/safeRedirect";
import { startSession } from "@/lib/session";
import type { AvailabilityResult } from "./signup";

/**
 * Sign-up with the FLEXTV backend (docs/development/flextv-backend.md "회원가입"). New members are FLEXTV members with
 * FLEXTV's rules (lib/flextv/rules.ts): 약관 동의 → 계정 설정, and the member is signed in right away. There is no SMS
 * step: FLEXTV's 본인인증 (NICE) is asked where FLEXTV needs it (첫 충전 · 방송), not at sign-up.
 *
 * TBD (FLEXTV side): FLEXTV does not store the agreements yet — they are checked here and must be recorded once FLEXTV
 * takes them (docs/development/flextv-backend.md "FLEXTV에 필요한 변경").
 */

/** FLEXTV's sign-up consents (2026-11-01): 이용약관 · 개인정보 수집 및 이용 (필수), 마케팅 활용 및 정보 수신 (선택). */
type Agreements = { service: boolean; privacy: boolean; marketing: boolean };

export type FlextvSignupRequest = { loginId: string; password: string; nickname: string; agreements: Agreements };

export type FlextvSignupResult =
  /** `signedIn` false: the account exists but FLEXTV issued no session — the member signs in on /login. */
  | { status: "CREATED"; signedIn: boolean }
  | { status: "LOGIN_ID_TAKEN" }
  | { status: "NICKNAME_TAKEN" }
  /** The nickname has a word FLEXTV does not allow. */
  | { status: "FORBIDDEN" }
  /** FLEXTV refuses sign-ups from this IP. */
  | { status: "BLOCKED" }
  | { status: "INVALID" };

export type SocialSignupResult =
  | { status: "CREATED"; next: string }
  /** The social sign-in is gone (10 minutes passed, or FLEXTV no longer accepts the provider's token): start again. */
  | { status: "EXPIRED" }
  /** This social account is already a FLEXTV member: sign in with it. */
  | { status: "ALREADY_MEMBER" }
  | { status: "NICKNAME_TAKEN" }
  | { status: "FORBIDDEN" }
  | { status: "BLOCKED" }
  | { status: "INVALID" };

const notConnected = () => new Error("FLEXTV sign-up is not enabled (NEXT_PUBLIC_BACKEND).");

const requiredAgreed = (a: unknown): a is Agreements =>
  typeof a === "object" && a !== null && (a as Agreements).service === true && (a as Agreements).privacy === true && typeof (a as Agreements).marketing === "boolean";

export async function checkLoginIdAvailability(loginId: string): Promise<AvailabilityResult> {
  if (!FLEXTV_AUTH) throw notConnected();
  if (typeof loginId !== "string" || !isFlextvLoginId(loginId)) return { available: false, reason: "INVALID" };
  if (hasReservedLoginWord(loginId)) return { available: false, reason: "FORBIDDEN" };
  return (await checkLoginId(loginId)) === "AVAILABLE" ? { available: true } : { available: false, reason: "DUPLICATE" };
}

/** Advisory like the mock's: FLEXTV checks forbidden words only on sign-up (FORBIDDEN there). */
export async function checkFlextvNicknameAvailability(nickname: string): Promise<AvailabilityResult> {
  if (!FLEXTV_AUTH) throw notConnected();
  if (typeof nickname !== "string" || !isFlextvNickname(nickname.trim())) return { available: false, reason: "INVALID" };
  const answer = await checkNickname(nickname.trim());
  return answer === "AVAILABLE" ? { available: true } : { available: false, reason: answer === "TAKEN" ? "DUPLICATE" : "INVALID" };
}

export async function createFlextvAccount(request: FlextvSignupRequest): Promise<FlextvSignupResult> {
  if (!FLEXTV_AUTH) throw notConnected();
  const r = (typeof request === "object" && request !== null ? request : {}) as Partial<FlextvSignupRequest>;
  const nickname = typeof r.nickname === "string" ? r.nickname.trim() : "";
  const valid =
    typeof r.loginId === "string" &&
    isFlextvLoginId(r.loginId) &&
    typeof r.password === "string" &&
    isFlextvPassword(r.password) &&
    isFlextvNickname(nickname) &&
    requiredAgreed(r.agreements);
  if (!valid) return { status: "INVALID" };
  // FLEXTV answers this one with the same message as a forbidden nickname word: refuse it here so the two stay apart.
  if (hasReservedLoginWord(r.loginId!)) return { status: "INVALID" };

  const context = await requestDeviceContext();
  const outcome = await signUp({ loginId: r.loginId!, password: r.password!, nickname }, context);
  if (outcome.kind !== "CREATED") return { status: refusal(outcome) };

  // FLEXTV sets its tokens as cookies with the sign-up; if they did not come through, sign in for them.
  let tokens = outcome.tokens;
  let member = outcome.member;
  if (!tokens) {
    const signedIn = await signIn({ loginId: r.loginId!, password: r.password!, keepSignedIn: false }, context).catch(() => null);
    if (signedIn?.kind === "OK") ({ tokens, member } = signedIn);
  }
  if (!tokens) return { status: "CREATED", signedIn: false };
  await startSession({ keepSignedIn: false, tokens, session: member && sessionFromMember(member) });
  return { status: "CREATED", signedIn: true };
}

/**
 * Finishes a social sign-up started by /auth/[provider]/callback: the provider's token waits in an httpOnly cookie for
 * 10 minutes while the member agrees to the terms and picks a nickname.
 */
export async function completeSocialSignup({ nickname, agreements }: { nickname: string; agreements: Agreements }): Promise<SocialSignupResult> {
  if (!FLEXTV_AUTH) throw notConnected();
  const name = typeof nickname === "string" ? nickname.trim() : "";
  if (!isFlextvNickname(name) || !requiredAgreed(agreements)) return { status: "INVALID" };
  const jar = await cookies();
  const pending = decodeSocialSignup(jar.get(SOCIAL_SIGNUP_COOKIE)?.value);
  if (!pending) return { status: "EXPIRED" };

  const context = await requestDeviceContext();
  const outcome = await signUpWithProvider(pending.provider, pending.token, name, context);
  if (outcome.kind === "PROVIDER_REFUSED") {
    jar.delete(SOCIAL_SIGNUP_COOKIE);
    return { status: "EXPIRED" };
  }
  if (outcome.kind !== "CREATED") {
    const status = refusal(outcome);
    return status === "LOGIN_ID_TAKEN" ? { status: "ALREADY_MEMBER" } : { status };
  }

  jar.delete(SOCIAL_SIGNUP_COOKIE);
  let tokens = outcome.tokens;
  let member = outcome.member;
  if (!tokens) {
    const signedIn = await signInWithProvider(pending.provider, pending.token, context).catch(() => null);
    if (signedIn?.kind === "OK") ({ tokens, member } = signedIn);
  }
  // The member exists either way; without tokens they sign in with the same social account.
  if (!tokens) return { status: "CREATED", next: "/login" };
  await startSession({ keepSignedIn: false, tokens, session: member && sessionFromMember(member) });
  return { status: "CREATED", next: safeRedirectPath(pending.next) };
}

function refusal(outcome: Exclude<SignUpOutcome, { kind: "CREATED" }>): "LOGIN_ID_TAKEN" | "NICKNAME_TAKEN" | "FORBIDDEN" | "BLOCKED" | "INVALID" {
  switch (outcome.kind) {
    case "LOGIN_ID_TAKEN":
    case "NICKNAME_TAKEN":
    case "BLOCKED":
      return outcome.kind;
    case "FORBIDDEN_WORD":
      return "FORBIDDEN";
    default:
      return "INVALID";
  }
}
