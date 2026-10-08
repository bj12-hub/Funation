import { vi } from "vitest";
import type { Role } from "@/types/role";

/**
 * Test helpers for the mock backend. Services keep their state on `globalThis.__funationMock*`,
 * so each test clears those keys and re-imports the modules to start from the seed data.
 */

export const sessionState: { roles: Role[] | null; userId: string } = { roles: ["SUPPORTER", "CREATOR"], userId: "u-test" };

/** Signed in with these roles, or signed out with `null`. */
export const signIn = (roles: Role[] | null = ["SUPPORTER", "CREATOR"]) => {
  sessionState.roles = roles;
};

/** Signed in as another member (same roles and profile, different id); resetMockStores() goes back to "u-test". */
export const signInAs = (userId: string) => {
  sessionState.userId = userId;
};

export function mockSessionModule() {
  const session = () =>
    sessionState.roles ? { userId: sessionState.userId, nickname: "홍길동", funationId: "hongGD123", avatarUrl: null, roles: [...sessionState.roles] } : null;
  return {
    SESSION_COOKIE: "funation_session",
    getSession: vi.fn(async () => session()),
    getCreatorSession: vi.fn(async () => (sessionState.roles?.includes("CREATOR") ? session() : null)),
    hasRole: (s: { roles: Role[] } | null, role: Role) => !!s && s.roles.includes(role),
    startSession: vi.fn(),
    endSession: vi.fn(),
    revokeSession: vi.fn()
  };
}

export function resetMockStores() {
  for (const key of Object.keys(globalThis)) {
    if (key.startsWith("__funationMock")) delete (globalThis as Record<string, unknown>)[key];
  }
  vi.resetModules();
  signIn();
  signInAs("u-test");
}

/** A valid Idempotency-Key (16–64 of [A-Za-z0-9-]). */
export const key = (n = 1) => `test-key-${String(n).padStart(8, "0")}`;

/**
 * Marks the mock account 본인인증 완료 with the Figma sample identity (no real data), as the 마이페이지
 * verification does. 정산 신청 requires it (2026-10-06 결정). Call after resetMockStores().
 */
export async function verifyMockIdentity() {
  const { mockAccount } = await import("@/services/account/mockStore");
  mockAccount.identity = { name: "홍길동", birthDate: "1995-01-01", verifiedAt: new Date().toISOString() };
}

/**
 * 재가입 in the mock's one account slot: the account withdraws and someone signs up with `phone`, the number verified
 * at sign-up. The same phone is the same person (2026-10-08 결정: 출석 · 이벤트 · 투표 once per person); another is not
 * — nor is the same phone once the withdrawn account's 본인 확인 값 is gone (1 year, account/retentionPolicy.ts).
 */
export async function rejoinWithPhone(phone: string, now = new Date()) {
  const { recordWithdrawal } = await import("@/services/account/withdrawalRecord");
  const { startNewAccount } = await import("@/services/account/rejoin");
  recordWithdrawal({ at: now.toISOString(), requestId: "w-test", forfeitedFn: 0, forfeitedEarningsFn: 0 });
  if (!startNewAccount({ nickname: "다시왔어요", password: "newpass12!", marketing: false, phone }, now)) throw new Error("재가입 failed");
}

/**
 * A fresh single-use phone verification token, as the 휴대폰 인증 step gets it (mock code 123456). Mock numbers
 * only: 010-0000-0000 for sign-up, the sample account's 010-1234-5678 for a password reset.
 */
export async function phoneToken(purpose: "SIGNUP" | "PASSWORD_RESET" = "SIGNUP", phone = purpose === "SIGNUP" ? "010-0000-0000" : "010-1234-5678") {
  const { sendPhoneCode, verifyPhoneCode } = await import("@/services/auth/verification");
  if ((await sendPhoneCode(phone, purpose)).status !== "SENT") throw new Error(`no code sent to ${phone}`);
  const result = await verifyPhoneCode(phone, purpose, "123456");
  if (result.status !== "VERIFIED") throw new Error("phone verification failed");
  return result.verificationToken;
}
