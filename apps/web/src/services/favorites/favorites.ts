"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getSession } from "@/lib/session";
import { isCreatorSuspended } from "@/services/admin/memberCore";
import { getCreatorById } from "@/services/creators/creators";

/**
 * Favorite creators of the signed-in member.
 * Figma: funation-favorites-page 735:3856 (route `/favorites`, signed-in members only)
 * Reads return `null` without a session; the removal action re-checks the session.
 * A suspended creator is hidden from the list while suspended and comes back after (2026-10-08 결정).
 */

export type FavoriteCreator = {
  creatorId: string;
  name: string;
  avatarUrl: string;
  subscriberCount: number;
  verified: boolean;
  isLive: boolean;
};

export type FavoritesPage = {
  items: FavoriteCreator[];
  totalCount: number;
  page: number;
  totalPages: number;
};

export type PromotionBanner = {
  label: string;
  title: string;
  description: string;
  ctaLabel: string;
  /** Destination is TBD; the CTA renders as unavailable without it. */
  href?: string;
};

const PAGE_SIZE = 10;

export async function getFavorites({ query, page = 1 }: { query?: string; page?: number }): Promise<FavoritesPage | null> {
  if (!USE_MOCK) throw new Error("Favorites API is not connected yet.");
  if (!(await getSession())) return null;
  await mockDelay(300);
  const keyword = query?.trim().toLowerCase();
  // 2026-10-08 결정: a suspended creator is gone from the list while suspended (the public screens' rule, as in
  // getCreatorById). The entry stays stored, so it is back once the suspension ends; counts and pages follow the list.
  const filtered = favorites().filter((f) => !isCreatorSuspended(f.creatorId) && (!keyword || f.name.toLowerCase().includes(keyword)));
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(Math.max(1, page), totalPages);
  return {
    items: filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE),
    totalCount: filtered.length,
    page: current,
    totalPages
  };
}

export async function removeFavorite(creatorId: unknown): Promise<{ status: "REMOVED" | "NOT_FOUND" | "UNAUTHORIZED" }> {
  if (!USE_MOCK) throw new Error("Favorites API is not connected yet.");
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  await mockDelay(400);
  const list = favorites();
  const index = list.findIndex((f) => f.creatorId === creatorId);
  if (index < 0) return { status: "NOT_FOUND" };
  list.splice(index, 1);
  return { status: "REMOVED" };
}

/** Whether the signed-in member has favorited the creator (false for guests). */
export async function isFavorite(creatorId: string): Promise<boolean> {
  if (!USE_MOCK) throw new Error("Favorites API is not connected yet.");
  if (!(await getSession())) return false;
  return favorites().some((f) => f.creatorId === creatorId);
}

/** Figma 826:510 — adds the creator; idempotent (adding twice keeps one entry). */
export async function addFavorite(creatorId: unknown): Promise<{ status: "ADDED" | "NOT_FOUND" | "UNAUTHORIZED" }> {
  if (!USE_MOCK) throw new Error("Favorites API is not connected yet.");
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  if (typeof creatorId !== "string") return { status: "NOT_FOUND" };
  const creator = await getCreatorById(creatorId);
  if (!creator) return { status: "NOT_FOUND" };
  await mockDelay(300);
  const list = favorites();
  if (!list.some((f) => f.creatorId === creatorId)) {
    list.unshift({
      creatorId,
      name: creator.name,
      avatarUrl: creator.avatarUrl,
      subscriberCount: creator.subscriberCount,
      verified: true,
      isLive: creator.isLive
    });
  }
  return { status: "ADDED" };
}

export async function getFavoritesPromotion(): Promise<PromotionBanner | null> {
  if (!USE_MOCK) return null;
  // Figma 735:3955 copy. The design says "투네이션", another company's brand; the mock uses Funation.
  // TBD: the "1,000 FN" reward and title are promotion policy, and the CTA destination.
  return {
    label: "이벤트",
    title: "썸네이션 공식 카카오톡 채널 연동 이벤트!",
    description: "지금 카카오톡 채널 추가하고 간편 계정 연동을 완료해보세요. 1,000 FN 즉시 적립 및 단독 칭호 즉시 지급!",
    ctaLabel: "채널 바로 연동하기"
  };
}

// ── Mock data: Figma 735:3856 rows (kept on globalThis; see services/account/mockStore.ts) ──

const globalForFavorites = globalThis as typeof globalThis & { __funationMockFavorites?: FavoriteCreator[] };

function favorites() {
  return (globalForFavorites.__funationMockFavorites ??= [
    { creatorId: "c4", name: "불꽃크루", avatarUrl: "/mock/favorites/creator-1.png", subscriberCount: 91_000, verified: true, isLive: true },
    { creatorId: "c3", name: "밤톨게임", avatarUrl: "/mock/favorites/creator-2.png", subscriberCount: 27_000, verified: true, isLive: false },
    { creatorId: "c1", name: "하루봄", avatarUrl: "/mock/favorites/creator-3.png", subscriberCount: 48_000, verified: true, isLive: true },
    { creatorId: "c2", name: "도도쭈", avatarUrl: "/mock/favorites/creator-4.png", subscriberCount: 36_000, verified: true, isLive: false }
  ]);
}
