"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getSession } from "@/lib/session";
import type { Platform } from "@/types/platform";

/**
 * Signed-in member's own account (my page).
 * Figma: funation-my-page 622:4 · 735:4119 (route `/mypage`, signed-in members only)
 *
 * The server owns every value here. In particular `fnBalance` is display-only and must never be
 * computed or adjusted in the browser. Updates must be authorized by the backend session.
 *
 * Server Actions: they run on the server with the session cookie. Mock values live in server
 * memory, so changes survive a page reload until the dev server restarts.
 */

export type LoginProvider = "NAVER" | "GOOGLE" | "KAKAO";

export type RankingVisibilityKey = "quest" | "luckyBox" | "play";

export type MyAccount = {
  nickname: string;
  funationId: string;
  avatarUrl: string | null;
  linkedLoginProviders: Record<LoginProvider, boolean>;
  identityVerified: boolean;
  fnBalance: number;
  rankingVisibility: Record<RankingVisibilityKey, boolean>;
  /** Broadcasting platform accounts; `handle` is null when not connected. */
  connectedPlatforms: { platform: Platform; handle: string | null }[];
  marketingConsent: boolean;
};

export type UpdateResult = { status: "SAVED" } | { status: "FAILED" };

/** Returns `null` when there is no signed-in session. */
export async function getMyAccount(): Promise<MyAccount | null> {
  if (!USE_MOCK) return null;
  const session = await getSession();
  if (!session) return null;
  await mockDelay(300);
  return structuredClone(MOCK_ACCOUNT);
}

// Server Actions below can be called directly from the browser: check the session and the input.

const RANKING_KEYS: readonly RankingVisibilityKey[] = ["quest", "luckyBox", "play"];

export async function updateRankingVisibility(key: RankingVisibilityKey, visible: boolean): Promise<UpdateResult> {
  if (!USE_MOCK) throw new Error("Account API is not connected yet.");
  if (!(await getSession()) || !RANKING_KEYS.includes(key) || typeof visible !== "boolean") return { status: "FAILED" };
  await mockDelay(500);
  MOCK_ACCOUNT.rankingVisibility[key] = visible;
  return { status: "SAVED" };
}

export async function updateMarketingConsent(agreed: boolean): Promise<UpdateResult> {
  if (!USE_MOCK) throw new Error("Account API is not connected yet.");
  if (!(await getSession()) || typeof agreed !== "boolean") return { status: "FAILED" };
  await mockDelay(500);
  MOCK_ACCOUNT.marketingConsent = agreed;
  return { status: "SAVED" };
}

// ── Mock data: Figma 735:4119 ─────────────────────────────────────────────────

const MOCK_ACCOUNT: MyAccount = {
  nickname: "홍길동",
  funationId: "hongGD123",
  avatarUrl: "/mock/account/avatar.png",
  linkedLoginProviders: { NAVER: false, GOOGLE: true, KAKAO: true },
  identityVerified: false,
  fnBalance: 5_000,
  rankingVisibility: { quest: true, luckyBox: true, play: false },
  connectedPlatforms: [
    { platform: "YOUTUBE", handle: "hongGD_tube" },
    { platform: "FLEXTV", handle: null },
    { platform: "SOOP", handle: null }
  ],
  marketingConsent: false
};
