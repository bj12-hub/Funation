"use server";

import { USE_MOCK } from "@/lib/mock";
import { getSession } from "@/lib/session";
import { roomView } from "./rouletteCore";
import type { RoomRoulette } from "./rouletteTypes";

/**
 * 룰렛 in the creator room (code-first): waiting count and today's participants for everyone, plus the
 * signed-in viewer's own participations (대기 순서 · 결과). Participating goes through the Donation Core.
 * TBD: realtime push instead of polling.
 */
export async function getRoomRoulette(channelId: unknown): Promise<RoomRoulette | null> {
  if (!USE_MOCK) throw new Error("Roulette API is not connected yet.");
  if (typeof channelId !== "string" || !/^[\w-]{1,40}$/.test(channelId)) return null;
  const session = await getSession();
  return roomView(channelId, session?.userId ?? null);
}
