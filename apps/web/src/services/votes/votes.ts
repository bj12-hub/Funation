"use server";

import { USE_MOCK } from "@/lib/mock";
import { getSession } from "@/lib/session";
import { castBallot, currentRun, roomVote } from "./voteCore";
import type { CastVoteResult, RoomVote } from "./voteTypes";

/**
 * 투표 in the creator room (code-first, 무료 투표 — 2026-10-04 결정). Reading is public; voting needs a
 * signed-in member and counts once per member. TBD: realtime push instead of polling, rate limiting.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Vote API is not connected yet.");
};

const isChannelId = (v: unknown): v is string => typeof v === "string" && /^[\w-]{1,40}$/.test(v);

/** The channel's current vote (running, or ended but still on screen), or null. */
export async function getRoomVote(channelId: unknown): Promise<RoomVote | null> {
  assertMock();
  if (!isChannelId(channelId)) return null;
  const run = currentRun(channelId);
  if (!run) return null;
  const session = await getSession();
  return roomVote(run, session?.userId ?? null);
}

export async function castVote(input: unknown): Promise<CastVoteResult> {
  assertMock();
  const session = await getSession();
  if (!session) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as { channelId?: unknown; voteId?: unknown; item?: unknown };
  if (!isChannelId(v.channelId) || typeof v.voteId !== "string") return { status: "INVALID", message: "투표 정보를 확인해 주세요." };
  const run = currentRun(v.channelId);
  // A vote that was replaced or taken off the screen is gone for the room.
  if (!run || run.id !== v.voteId) return { status: "NOT_FOUND" };
  const outcome = castBallot(run, session.userId, v.item);
  if (outcome === "INVALID") return { status: "INVALID", message: "투표 항목을 확인해 주세요." };
  return { status: outcome, vote: roomVote(run, session.userId) };
}
