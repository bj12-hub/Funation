import { FLEXTV_SSUMNATION_API } from "@/lib/flextv/mode";
import { fetchGames } from "@/lib/flextv/ssumnation";
import { getFlextvAccessToken, getSession } from "@/lib/session";
import type { RoomGacha } from "./gachaTypes";
import type { RoomRoulette } from "./rouletteTypes";

/**
 * The 룰렛 · 뽑기 panels of a FLEXTV channel's room (phase 6): FLEXTV's spins and draws through the Ssumnation endpoint.
 * Every viewer's panel asks every 3 seconds, so one answer per channel and viewer is kept 2 seconds on this server.
 */

const TTL_MS = 2_000;
const MAX = 2_000;
type Games = { roulette: RoomRoulette; gacha: RoomGacha };
const g = globalThis as typeof globalThis & { __ssumnationFlextvGames?: Map<string, { at: number; games: Promise<Games | null> }> };
const cache = (g.__ssumnationFlextvGames ??= new Map());

export async function flextvRoomGames(channelId: string): Promise<Games | null> {
  if (!FLEXTV_SSUMNATION_API) return null;
  const session = await getSession();
  const token = session ? await getFlextvAccessToken() : null;
  const key = `${channelId}:${session?.userId ?? "guest"}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < TTL_MS) return hit.games;
  if (cache.size >= MAX) for (const [k, e] of cache) if (now - e.at >= TTL_MS || cache.size >= MAX) cache.delete(k);
  const games = fetchGames(channelId, token).catch(() => null);
  cache.set(key, { at: now, games });
  return games;
}
