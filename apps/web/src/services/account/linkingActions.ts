"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getSession } from "@/lib/session";
import type { Platform } from "@/types/platform";
import type { LoginProvider } from "./myAccount";
import { mockAccount } from "./mockStore";

/**
 * My page account linking and verification.
 * Figma: 로그인 연동 743:2133 (Naver) · 743:2180 (Google) · 743:2227 (Kakao) · 본인인증 743:2274 + 750:*
 * · YouTube 연결 해제 743:2442 · FLEX TV 계정 연결 743:2488
 *
 * TBD (not designed / not decided): the social OAuth hand-off, the identity verification provider
 * (phone / i-PIN), attempt limits, and each platform's account-ownership API. The mocks below only
 * return the results the UI needs. Every action re-checks the session and its input.
 */

const PROVIDERS: readonly LoginProvider[] = ["NAVER", "GOOGLE", "KAKAO"];
const PLATFORMS: readonly Platform[] = ["YOUTUBE", "FLEXTV", "SOOP"];

export type LinkResult = { status: "LINKED" | "UNLINKED" } | { status: "INVALID" | "UNAUTHORIZED" };

export type VerificationMethod = "PHONE" | "IPIN";

export type VerificationResult =
  | { status: "VERIFIED"; name: string; verifiedAt: string }
  | { status: "ALREADY_VERIFIED"; name: string; birthDate: string; verifiedAt: string }
  /** Another account already uses this identity; only masked details are returned. */
  | { status: "DUPLICATE"; maskedFunationId: string; joinedAt: string }
  | { status: "LOCKED"; retryAt: string }
  | { status: "INVALID" }
  | { status: "UNAUTHORIZED" };

export type PlatformResult =
  | { status: "CONNECTED"; handle: string }
  | { status: "DISCONNECTED" }
  | { status: "INVALID_CODE" | "INVALID" | "UNAUTHORIZED" };

function assertMock() {
  if (!USE_MOCK) throw new Error("Account API is not connected yet.");
}

export async function linkLoginProvider(provider: unknown): Promise<LinkResult> {
  assertMock();
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  if (!PROVIDERS.includes(provider as LoginProvider)) return { status: "INVALID" };
  await mockDelay(500);
  // TODO: redirect to the provider's OAuth consent screen; the mock links a sample account.
  mockAccount.linkedLoginProviders[provider as LoginProvider] = {
    identifier: provider === "NAVER" ? "honggd@naver.com" : `honggd_${String(provider).toLowerCase()}`,
    linkedAt: new Date().toISOString()
  };
  return { status: "LINKED" };
}

export async function unlinkLoginProvider(provider: unknown): Promise<LinkResult> {
  assertMock();
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  if (!PROVIDERS.includes(provider as LoginProvider)) return { status: "INVALID" };
  await mockDelay(500);
  // TBD: whether the last remaining login method may be unlinked (not in Figma).
  mockAccount.linkedLoginProviders[provider as LoginProvider] = null;
  return { status: "UNLINKED" };
}

export async function verifyIdentity(method: unknown): Promise<VerificationResult> {
  assertMock();
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  if (method !== "PHONE" && method !== "IPIN") return { status: "INVALID" };
  if (mockAccount.identity) return { status: "ALREADY_VERIFIED", ...mockAccount.identity };
  await mockDelay(800);
  // TODO: hand off to the verification provider and receive its signed result on the server.
  // The mock always succeeds with the Figma sample identity (750:153).
  mockAccount.identity = { name: "홍길동", birthDate: "1995-01-01", verifiedAt: new Date().toISOString() };
  return { status: "VERIFIED", name: mockAccount.identity.name, verifiedAt: mockAccount.identity.verifiedAt };
}

export async function connectPlatform(input: { platform: unknown; accountId: unknown; code: unknown }): Promise<PlatformResult> {
  assertMock();
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  const { platform, accountId, code } = input ?? {};
  if (!PLATFORMS.includes(platform as Platform) || typeof accountId !== "string" || !/^[A-Za-z0-9_.-]{2,40}$/.test(accountId)) {
    return { status: "INVALID" };
  }
  await mockDelay(600);
  // TODO: verify ownership with the platform. The mock accepts codes shaped like Figma's "FN-2026-0920".
  if (typeof code !== "string" || !/^FN-\d{4}-\d{4}$/.test(code.trim())) return { status: "INVALID_CODE" };
  const entry = mockAccount.connectedPlatforms.find((p) => p.platform === platform);
  if (entry) entry.handle = accountId;
  return { status: "CONNECTED", handle: accountId };
}

export async function disconnectPlatform(platform: unknown): Promise<PlatformResult> {
  assertMock();
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  if (!PLATFORMS.includes(platform as Platform)) return { status: "INVALID" };
  await mockDelay(500);
  const entry = mockAccount.connectedPlatforms.find((p) => p.platform === platform);
  if (entry) entry.handle = null;
  return { status: "DISCONNECTED" };
}
