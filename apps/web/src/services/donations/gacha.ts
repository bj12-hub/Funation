"use server";

import { USE_MOCK } from "@/lib/mock";
import { getSession } from "@/lib/session";
import { currentPersonKey } from "@/services/account/mockStore";
import { accountSince } from "@/services/account/withdrawalCore";
import { roomView } from "./gachaCore";
import type { RoomGacha } from "./gachaTypes";

/**
 * 뽑기 in the creator room (code-first): the waiting count for everyone, plus the signed-in viewer's own
 * draws (실행 대기 · 결과) of the current account and the person's use today per 뽑기 (2026-10-08 결정).
 * Drawing goes through the Donation Core.
 * TBD: realtime push instead of polling.
 */
export async function getRoomGacha(channelId: unknown): Promise<RoomGacha | null> {
  if (!USE_MOCK) throw new Error("Gacha API is not connected yet.");
  if (typeof channelId !== "string" || !/^[\w-]{1,40}$/.test(channelId)) return null;
  const session = await getSession();
  return roomView(channelId, session ? { userId: session.userId, account: accountSince(), person: currentPersonKey() } : null);
}
