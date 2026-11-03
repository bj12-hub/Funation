"use server";

import { fetchStreamDonors, fetchViewerCount } from "@/lib/flextv/live";
import type { RoomLive } from "./roomLiveTypes";

/**
 * A FLEXTV stream's viewers and its top three donors for its room (phase 10, docs/development/flextv-backend.md
 * "10단계"), read as a visitor. Every open room asks every 15 seconds, so one answer per channel serves all of them for
 * a few seconds. Null when FLEXTV answered neither (the room keeps what it shows).
 */

const CACHE_MS = 5_000;
const CACHE_MAX = 500;
const g = globalThis as typeof globalThis & { __ssumnationFlextvRoomLive?: Map<string, { at: number; live: Promise<RoomLive | null> }> };
const cache = (g.__ssumnationFlextvRoomLive ??= new Map());

export async function getFlextvRoomLive(channelId: unknown): Promise<RoomLive | null> {
  if (typeof channelId !== "string" || !/^[1-9]\d{0,15}$/.test(channelId)) return null;
  const now = Date.now();
  const hit = cache.get(channelId);
  if (hit && now - hit.at < CACHE_MS) return hit.live;
  if (cache.size >= CACHE_MAX) {
    for (const [k, v] of cache) if (now - v.at >= CACHE_MS) cache.delete(k);
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  }
  const live = read(channelId);
  cache.set(channelId, { at: now, live });
  return live;
}

async function read(channelId: string): Promise<RoomLive | null> {
  const [viewers, donors] = await Promise.all([fetchViewerCount(channelId).catch(() => undefined), fetchStreamDonors(channelId).catch(() => undefined)]);
  if (viewers === undefined && donors === undefined) return null;
  return {
    viewers: viewers ?? null,
    donors: donors ? donors.map((d) => ({ rank: d.rank, nickname: d.nickname, amount: d.amount, avatarUrl: d.thumbUrl })) : null
  };
}
