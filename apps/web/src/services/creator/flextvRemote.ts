"use server";

import { FlextvUnavailableError } from "@/lib/flextv/client";
import { FLEXTV_SSUMNATION_API } from "@/lib/flextv/mode";
import { flextvGachaRemote, flextvOverlayKey, flextvQuestRemote, flextvRouletteRemote } from "./flextvBroadcastGames";
import type { GachaRemoteView } from "@/services/donations/gachaTypes";
import type { QuestRemoteView } from "@/services/donations/questTypes";
import type { RouletteRemoteView } from "@/services/donations/rouletteTypes";

/**
 * 리모컨 with FLEXTV (phase 6): what `/creator/remote` and `/popout/remote` show when FLEXTV's Ssumnation endpoints
 * are on — the 퀘스트 · 룰렛 · 뽑기 panels and the streamer's overlay key — and the key's reissue.
 */

export type FlextvRemoteView = { quest: QuestRemoteView; roulette: RouletteRemoteView; gacha: GachaRemoteView; overlayKey: string };

/** Null when signed out or not a streamer (the page sends them on). */
export async function getFlextvRemote(): Promise<FlextvRemoteView | null> {
  if (!FLEXTV_SSUMNATION_API) return null;
  const [quest, roulette, gacha, overlayKey] = await Promise.all([flextvQuestRemote(), flextvRouletteRemote(), flextvGachaRemote(), flextvOverlayKey()]);
  return quest && roulette && gacha && overlayKey ? { quest, roulette, gacha, overlayKey } : null;
}

export async function reissueFlextvOverlayKey(): Promise<{ status: "SAVED" | "UNAUTHORIZED" | "UNKNOWN" }> {
  if (!FLEXTV_SSUMNATION_API) return { status: "UNKNOWN" };
  try {
    return (await flextvOverlayKey(true)) ? { status: "SAVED" } : { status: "UNAUTHORIZED" };
  } catch (error) {
    if (error instanceof FlextvUnavailableError) return { status: "UNKNOWN" };
    throw error;
  }
}
