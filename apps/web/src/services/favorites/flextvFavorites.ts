import { requestFrom } from "@/lib/flextv/auth";
import { addFavorite, checkFavorite, fetchFavorites, removeFavorite, type FlextvChannelRow } from "@/lib/flextv/channels";
import { FlextvUnavailableError } from "@/lib/flextv/client";
import { isFlextvChannelId } from "@/lib/flextv/donation";
import { fetchMyAccount } from "@/lib/flextv/member";
import { FLEXTV_DEFAULT_AVATAR } from "@/lib/flextv/placeholders";
import { createQueue } from "@/lib/flextv/queue";
import { requestDeviceContext } from "@/lib/flextv/request";
import { getFlextvAccessToken } from "@/lib/session";
import type { FavoriteCreator, FavoritesPage } from "./favorites";

/**
 * 즐겨찾기 with FLEXTV (phase 7, docs/development/flextv-backend.md "7단계"): the channels a member keeps in FLEXTV's
 * 즐겨찾기, by FLEXTV channel id — the rooms at `/creators/{id}`. ./favorites.ts delegates here.
 *
 * FLEXTV takes a 즐겨찾기 only from a member who did its 본인인증; that is checked here first, so no channel is added
 * for a member FLEXTV would then turn away. An unclear answer is settled by FLEXTV's own check.
 */

const serialize = createQueue("favorites");
const PAGE_SIZE = 10;

export const favoriteOf = (row: FlextvChannelRow): FavoriteCreator => ({
  creatorId: row.channelId,
  name: row.name,
  avatarUrl: row.thumbUrl ?? FLEXTV_DEFAULT_AVATAR,
  subscriberCount: row.followers,
  verified: false,
  isLive: row.live
});

export async function flextvFavoritesPage({ query, page = 1 }: { query?: string; page?: number }): Promise<FavoritesPage | null> {
  const token = await getFlextvAccessToken();
  const rows = token ? await fetchFavorites(token) : null;
  if (!rows) return null;
  const keyword = query?.trim().toLowerCase();
  const filtered = rows.filter((r) => !keyword || r.name.toLowerCase().includes(keyword)).map(favoriteOf);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(Math.max(1, page), totalPages);
  return { items: filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE), totalCount: filtered.length, page: current, totalPages };
}

export async function flextvIsFavorite(channelId: string): Promise<boolean> {
  const token = await getFlextvAccessToken();
  if (!token || !isFlextvChannelId(channelId)) return false;
  return (await checkFavorite(token, channelId)) === true;
}

export type FlextvFavoriteAdd = { status: "ADDED" | "NOT_FOUND" | "UNAUTHORIZED" | "NEEDS_VERIFICATION" };

export async function flextvAddFavorite(channelId: unknown): Promise<FlextvFavoriteAdd> {
  const token = await getFlextvAccessToken();
  if (!token) return { status: "UNAUTHORIZED" };
  if (!isFlextvChannelId(channelId)) return { status: "NOT_FOUND" };
  const account = await fetchMyAccount(token);
  if (!account) return { status: "UNAUTHORIZED" };
  if (!account.verified) return { status: "NEEDS_VERIFICATION" };
  const caller = requestFrom(await requestDeviceContext());
  return serialize(token, async () => {
    const change = await addFavorite(token, channelId, caller);
    if (change === "UNAUTHORIZED") return { status: "UNAUTHORIZED" };
    if (change === "DONE") return { status: "ADDED" };
    // "FAIL": already kept (the end state asked for), or no such channel.
    const kept = await checkFavorite(token, channelId);
    return { status: kept === null ? "UNAUTHORIZED" : kept ? "ADDED" : "NOT_FOUND" };
  });
}

export async function flextvRemoveFavorite(channelId: unknown): Promise<{ status: "REMOVED" | "NOT_FOUND" | "UNAUTHORIZED" }> {
  const token = await getFlextvAccessToken();
  if (!token) return { status: "UNAUTHORIZED" };
  if (!isFlextvChannelId(channelId)) return { status: "NOT_FOUND" };
  const caller = requestFrom(await requestDeviceContext());
  return serialize(token, async () => {
    const change = await removeFavorite(token, channelId, caller);
    if (change === "UNAUTHORIZED") return { status: "UNAUTHORIZED" };
    if (change === "DONE") return { status: "REMOVED" };
    const kept = await checkFavorite(token, channelId);
    if (kept === null) return { status: "UNAUTHORIZED" };
    if (kept) throw new FlextvUnavailableError("FLEXTV kept the 즐겨찾기");
    return { status: "REMOVED" };
  });
}
