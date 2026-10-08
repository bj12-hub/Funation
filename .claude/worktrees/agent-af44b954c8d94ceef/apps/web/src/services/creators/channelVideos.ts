"use server";

import { USE_MOCK } from "@/lib/mock";
import { ADAPTERS } from "@/services/platforms/adapters";
import { PlatformError, type ChannelVideo, type PlatformErrorCode } from "@/services/platforms/platformTypes";
import { getCreatorRoom } from "./creatorRoom";

/**
 * 채널 영상 탭 — code-first. Lists videos from each of the channel's platforms whose adapter supports
 * VIDEO_LIST (YouTube today). Mock: public channels resolve their YouTube channel by creator id; the
 * studio's own list and visibility settings live in services/creator/youtube.ts (per-channel TBD).
 */
export type PublicChannelVideos = { videos: ChannelVideo[]; unsupported: boolean; error: PlatformErrorCode | null };

export async function getPublicChannelVideos(creatorId: unknown): Promise<PublicChannelVideos | null> {
  if (!USE_MOCK) throw new Error("Channel video API is not connected yet.");
  if (typeof creatorId !== "string") return null;
  const room = await getCreatorRoom(creatorId);
  if (!room) return null;
  const adapters = room.channels.map((c) => ADAPTERS[c.platform]).filter((a) => a.capabilities.includes("VIDEO_LIST"));
  if (adapters.length === 0) return { videos: [], unsupported: true, error: null };
  const videos: ChannelVideo[] = [];
  let error: PlatformErrorCode | null = null;
  for (const a of adapters) {
    try {
      const channel = await a.getChannel(`creator-${creatorId}`);
      videos.push(...(await a.listVideos(channel.externalChannelId, { max: 24 })));
    } catch (e) {
      error = e instanceof PlatformError ? e.code : "UNAVAILABLE";
    }
  }
  return { videos: videos.sort((x, y) => y.publishedAt.localeCompare(x.publishedAt)), unsupported: false, error };
}
